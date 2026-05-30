import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useOrderStore, Order } from '../stores/useOrderStore';
import { useAuthStore, hasPermission } from '../stores/useAuthStore';
import { useTableStore } from '../stores/useTableStore';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { ArrowLeft, Printer, CheckCircle, CreditCard, Banknote, Receipt, RefreshCw, Loader2, Plus, Trash2, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { printerService } from '../services/printerService';
import { format } from 'date-fns';

import { usePrinterStore } from '../stores/usePrinterStore';
import { useConfigStore } from '../stores/useConfigStore';

const Billing = () => {
  const { orderId } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const { generateBill, settlePayment } = useOrderStore();
  const { tables } = useTableStore();
  const { profile, loading: authLoading } = useAuthStore();
  const { autoPrintBill } = usePrinterStore();
  const { config } = useConfigStore();
  const [loading, setLoading] = useState(true);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'PERCENT' | 'FIXED'>('PERCENT');
  const [serviceCharge, setServiceCharge] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'UPI' | 'OTHER'>('CASH');
  const [processing, setProcessing] = useState(false);
  const [payments, setPayments] = useState<{method: 'CASH' | 'CARD' | 'UPI', amount: number}[]>([]);
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [showSettlement, setShowSettlement] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (config) {
      setServiceCharge(config.serviceChargePercentage || 0);
    }
  }, [config]);

  useEffect(() => {
    const fetchOrder = async () => {
      if (!orderId) return;
      const snap = await getDoc(doc(db, 'orders', orderId));
      if (snap.exists()) {
        const orderData = { id: snap.id, ...snap.data() } as Order;
        setOrder(orderData);
        
        const statusUpper = (orderData.orderStatus || '').toUpperCase();
        const isBilledOrCompleted = [
          'BILLED', 'BILL_GENERATED', 'GENERATED', 'PENDING_PAYMENT', 'COMPLETED'
        ].includes(statusUpper);

        if (isBilledOrCompleted) {
          setDiscountValue(orderData.discountAmount || 0);
          setDiscountType('FIXED');
          setServiceCharge(orderData.serviceChargeAmount || 0);
          
          if (statusUpper === 'COMPLETED' && orderData.payments) {
            setPayments(orderData.payments as any);
          } else {
            const remaining = orderData.balanceAmount !== undefined ? orderData.balanceAmount : Math.round(orderData.finalAmount || 0);
            setPayments([{ method: 'CASH', amount: remaining }]);
          }
        }
      }
      setLoading(false);
    };
    fetchOrder();
  }, [orderId]);

  if (authLoading || loading) return <div className="p-8 text-center font-black animate-pulse uppercase tracking-widest text-slate-400">Loading Bill...</div>;
  if (!order) return <div className="p-8 text-center font-black uppercase tracking-widest text-red-500">Order not found</div>;

  if (order.orderStatus === 'cancelled') {
    return (
      <div className="max-w-md mx-auto mt-20 p-10 bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Trash2 size={32} />
        </div>
        <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Order Cancelled</h2>
        <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest leading-loose">
          This order has been cancelled and cannot be billed.<br/>
          Reason: {order.cancellationReason || 'Not specified'}
        </p>
        <button 
          onClick={() => navigate('/orders')} 
          className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all"
        >
          Back to Orders
        </button>
      </div>
    );
  }

  const subtotal = order.subtotal || order.totalAmount;
  
  const calculatedDiscount = discountType === 'PERCENT' 
    ? Math.round((subtotal * discountValue) / 100)
    : discountValue;

  const taxableAmount = Math.max(0, subtotal - calculatedDiscount);
  
  const gstRate = (config?.gstPercentage || 5) / 100;
  let gst = 0;
  let amountToDisplay = taxableAmount;

  if (config?.isGstInclusive) {
    // subtotal already includes GST
    const baseAmount = taxableAmount / (1 + gstRate);
    gst = taxableAmount - baseAmount;
  } else {
    // add GST over taxable
    gst = taxableAmount * gstRate;
  }

  const grandTotal = (config?.isGstInclusive ? taxableAmount : (taxableAmount + gst)) + serviceCharge;
  const roundedTotal = Math.round(grandTotal);

  const canBill = hasPermission(profile, 'generateBill');
  const canSettle = hasPermission(profile, 'settlePayment');
  const totalEntered = payments.reduce((sum, p) => sum + p.amount, 0);
  const remainingExpected = order.balanceAmount !== undefined ? order.balanceAmount : roundedTotal;
  const isSufficientPaid = totalEntered > 0;
  const isFullPayment = (order.paidAmount || 0) + totalEntered >= roundedTotal;

  const handleGenerateBill = async () => {
    console.log("DEBUG: handleGenerateBill clicked.", {
      orderId: order.id,
      currentOrderStatus: order.orderStatus,
      paymentStatus: order.paymentStatus,
      billingStatus: order.billingStatus,
      tableNumber: order.tableNumber
    });

    if (!canBill) {
      console.warn("DEBUG: Billing blocked. User not authorized to generate bills.");
      return toast.error("Not authorized to generate bills");
    }

    const statusUpper = (order.orderStatus || '').toUpperCase();
    const isAlreadyGenerated = ['BILLED', 'BILL_GENERATED', 'GENERATED', 'PENDING_PAYMENT'].includes(statusUpper);

    if (isAlreadyGenerated) {
      console.log("DEBUG: Bill is already generated. Directly opening settlement.");
      setShowSettlement(true);
      return;
    }

    const allowedStatuses = ['RUNNING', 'KOT_SERVED', 'READY'];
    if (!allowedStatuses.includes(statusUpper)) {
      console.warn("DEBUG: Billing blocked. Invalid order status.", {
        orderStatus: order.orderStatus,
        allowedStatuses
      });
      return toast.error(`Bill can only be generated for RUNNING, KOT_SERVED, or READY orders (current status is "${order.orderStatus || 'unknown'}")`);
    }
    
    setProcessing(true);
    try {
      const { generateBill } = useOrderStore.getState();
      await generateBill(order.id!, { 
        discountAmount: calculatedDiscount, 
        serviceChargeAmount: serviceCharge,
        gstAmount: gst,
        finalAmount: roundedTotal
      });

      console.log("DEBUG: generateBill state action completed successfully");
      const snap = await getDoc(doc(db, 'orders', order.id!));
      if (snap.exists()) {
        const updatedOrder = { id: snap.id, ...snap.data() } as Order;
        console.log("DEBUG: Loaded freshly updated order from firestore.", {
          orderId: updatedOrder.id,
          orderStatus: updatedOrder.orderStatus,
          paymentStatus: updatedOrder.paymentStatus,
          billingStatus: updatedOrder.billingStatus
        });
        setOrder(updatedOrder);
        setPayments([{ method: 'CASH', amount: Math.round(updatedOrder.finalAmount || 0) }]);
        toast.success("Bill generated & pending settlement");
        
        console.log("DEBUG: Navigating instantly to Pending Bills screen");
        navigate('/pending-bills');
      }
    } catch (err: any) {
      console.error("DEBUG: Billing flow error encountered:", err);
      toast.error(`Billing flow error: ${err.message || 'unknown error'}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSettle = async () => {
    if (!isSufficientPaid) return toast.error("Total payment amount is less than bill amount");
    setProcessing(true);
    try {
      const { settlePayment } = useOrderStore.getState();
      const tableId = order.tableId || tables.find(t => t.tableNumber === order.tableNumber)?.id;
      if (!tableId) throw new Error("Table not found");

      await settlePayment(order.id!, tableId, payments);
      
      if (autoPrintBill) {
        printerService.connect().then(() => {
          const encoded = printerService.encodeReceipt({
            type: 'BILL',
            tableNumber: order.tableNumber,
            captainName: order.captainName,
            items: order.items,
            subtotal: subtotal,
            discountAmount: calculatedDiscount,
            gstAmount: gst,
            serviceChargeAmount: serviceCharge,
            finalAmount: roundedTotal,
            orderId: order.id!
          }, config);
          printerService.print(encoded);
        });
      }

      toast.success("Payment settled & Order completed");
      navigate('/pending-bills');
    } catch (e) {
      toast.error("Settlement failed");
    } finally {
      setProcessing(false);
    }
  };

  const handleAddPayment = () => {
    setPayments([...payments, { method: 'CASH', amount: 0 }]);
  };

  const removePayment = (index: number) => {
    setPayments(payments.filter((_, i) => i !== index));
  };

  const updatePayment = (index: number, field: string, value: any) => {
    const newPayments = [...payments];
    newPayments[index] = { ...newPayments[index], [field]: value };
    setPayments(newPayments);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/orders')} className="p-3 hover:bg-slate-100 rounded-xl transition-all border border-slate-200 shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Checkout</h2>
            <p className="text-indigo-600 text-xs font-black uppercase tracking-widest mt-1">Table {order.tableNumber}</p>
          </div>
        </div>
      </header>

      <div className="bg-white rounded-[2.5rem] p-10 border border-slate-100 shadow-2xl space-y-10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl mb-4">
            <Receipt size={24} />
          </div>
          <h3 className="font-black text-2xl uppercase tracking-tighter text-slate-900 leading-none">Order Invoice</h3>
          <p className="text-[10px] uppercase font-black tracking-[0.2em] text-slate-400 mt-2">Bill No: {order.lastBillId ? order.id?.slice(-6) : 'Draft'}</p>
        </div>

        <div className="space-y-4 pt-4 border-t border-slate-50">
          {order.items.map((item, idx) => (
            <div key={idx} className={`flex justify-between items-center group ${item.status === 'cancelled' ? 'opacity-40 grayscale' : ''}`}>
              <div className="flex-1">
                <p className={`text-sm font-bold ${item.status === 'cancelled' ? 'text-rose-600 line-through' : 'text-slate-800'}`}>{item.itemName}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase">₹{item.price} x {item.quantity}</p>
              </div>
              <p className={`font-black italic ${item.status === 'cancelled' ? 'text-rose-400' : 'text-slate-900'}`}>
                ₹{item.status === 'cancelled' ? 0 : (item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>

        <div className="bg-slate-50 rounded-3xl p-8 space-y-6 border border-slate-100">
           {['RUNNING', 'KOT_SERVED', 'READY'].includes((order.orderStatus || '').toUpperCase()) && (
            <div className="space-y-4 pb-4 border-b border-slate-200">
              <div className="flex justify-between items-end">
                <p className="text-[10px] uppercase font-black text-slate-400 tracking-[0.2em]">Apply Discount</p>
                <div className="flex bg-white border border-slate-200 rounded-xl p-1 scale-90 origin-right">
                  <button
                    onClick={() => setDiscountType('PERCENT')}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${discountType === 'PERCENT' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    %
                  </button>
                  <button
                    onClick={() => setDiscountType('FIXED')}
                    className={`px-4 py-2 rounded-lg text-xs font-black transition-all ${discountType === 'FIXED' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    ₹
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative">
                  <input
                    type="number"
                    value={discountValue || ''}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    placeholder="Discount"
                    className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl font-black text-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black">
                    {discountType === 'PERCENT' ? '%' : '₹'}
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="number"
                    value={serviceCharge || ''}
                    onChange={(e) => setServiceCharge(Number(e.target.value))}
                    placeholder="Srv. Chg"
                    className="w-full bg-white border border-slate-200 px-5 py-3 rounded-2xl font-black text-lg focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all outline-none"
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black">₹</span>
                </div>
              </div>
            </div>
           )}

           <div className="space-y-3">
              <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                 <span>Subtotal</span>
                 <span className="text-slate-700">₹{subtotal.toFixed(2)}</span>
              </div>
              {calculatedDiscount > 0 && (
                <div className="flex justify-between text-xs font-bold text-emerald-500 uppercase tracking-widest">
                   <span>Discount</span>
                   <span>-₹{calculatedDiscount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-xs font-bold text-slate-400 uppercase tracking-widest">
                 <span>GST ({config?.gstPercentage || 5}%) {config?.isGstInclusive ? '(Incl.)' : ''}</span>
                 <span className="text-slate-700">₹{gst.toFixed(2)}</span>
              </div>
              <div className="pt-4 border-t-2 border-slate-900 flex justify-between items-center">
                 <h4 className="text-xl font-black uppercase text-slate-900 italic tracking-tighter">Amount Payable</h4>
                 <span className="text-4xl font-black text-indigo-600 italic tracking-tighter">₹{roundedTotal}</span>
              </div>
           </div>
        </div>

        {((order.orderStatus === 'completed' || order.orderStatus === 'COMPLETED')) ? (
          <div className="space-y-6 pt-6 border-t border-slate-100 italic">
            <div className="flex items-center justify-between">
               <h4 className="text-sm font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                 <CheckCircle size={18} />
                 Payment Settled
               </h4>
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                 {order.timestamp?.toDate ? format(order.timestamp.toDate(), 'dd MMM yyyy') : ''}
               </span>
            </div>

            <div className="space-y-3">
              {payments.map((p, idx) => (
                <div key={idx} className="flex justify-between items-center bg-emerald-50/30 p-4 rounded-2xl border border-emerald-100">
                  <div className="flex items-center gap-3">
                    {p.method === 'CASH' && <Banknote size={16} className="text-emerald-500" />}
                    {p.method === 'CARD' && <CreditCard size={16} className="text-indigo-500" />}
                    {p.method === 'UPI' && <Smartphone size={16} className="text-blue-500" />}
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-700">{p.method}</span>
                  </div>
                  <span className="font-black text-slate-900 italic">₹{p.amount}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => {
                printerService.connect().then(() => {
                  const encoded = printerService.encodeReceipt({
                    title: 'Tax Invoice (Reprint)',
                    type: 'BILL',
                    tableNumber: order.tableNumber,
                    captainName: order.captainName,
                    items: order.items,
                    subtotal: subtotal,
                    discountAmount: calculatedDiscount,
                    gstAmount: order.gstAmount || gst,
                    serviceChargeAmount: order.serviceChargeAmount || serviceCharge,
                    finalAmount: roundedTotal,
                    orderId: order.id!
                  }, config);
                  printerService.print(encoded);
                });
              }}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl flex items-center justify-center gap-3 shadow-xl hover:bg-black transition-all uppercase tracking-widest text-xs"
            >
              <Printer size={18} />
              Reprint Copy
            </button>
          </div>
        ) : ['BILLED', 'BILL_GENERATED', 'GENERATED', 'PENDING_PAYMENT'].includes((order.orderStatus || '').toUpperCase()) ? (
          !canSettle ? (
            <div className="p-8 text-center bg-slate-50 border border-dashed border-slate-200 rounded-[2rem] space-y-4 pt-6 mt-6">
              <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center mx-auto">
                <Loader2 size={24} className="animate-spin text-amber-500" />
              </div>
              <div>
                <h4 className="font-black text-sm text-slate-800 uppercase tracking-tight">Waiting for cashier</h4>
                <p className="text-[10px] text-slate-400 font-extrabold uppercase tracking-widest mt-1">Payment settlement is disabled for your account</p>
              </div>
            </div>
          ) : showSettlement ? (
            <div className="space-y-6 pt-6 border-t border-slate-100">
              <div className="flex items-center justify-between">
                 <h4 className="text-sm font-black uppercase tracking-widest text-slate-900">Payment Breakdown</h4>
                 <button onClick={handleAddPayment} className="text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:underline">
                    <Plus size={14} /> Add Method
                 </button>
              </div>

              <div className="space-y-3">
                {payments.map((p, idx) => (
                  <div key={idx} className="flex gap-3 items-center bg-slate-50 p-3 rounded-2xl border border-slate-100 animate-in fade-in slide-in-from-right-4">
                    <div className="flex bg-white rounded-xl p-0.5 shadow-sm border border-slate-100 flex-shrink-0">
                      {[
                        { id: 'CASH', icon: Banknote, color: 'text-emerald-500' },
                        { id: 'CARD', icon: CreditCard, color: 'text-indigo-500' },
                        { id: 'UPI', icon: Smartphone, color: 'text-blue-500' }
                      ].map((m) => {
                        const Icon = m.icon;
                        const isActive = p.method === m.id;
                        return (
                          <button
                             key={m.id}
                             onClick={() => updatePayment(idx, 'method', m.id)}
                             className={`px-3 py-2 rounded-lg transition-all flex items-center gap-1.5 ${isActive ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}
                             title={m.id}
                          >
                             <Icon size={14} className={isActive ? 'text-white' : m.color} />
                             <span className="text-[9px] font-black uppercase tracking-widest hidden sm:inline">{m.id}</span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex-1 relative">
                       <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-bold text-xs">₹</span>
                       <input 
                         type="number"
                         value={p.amount || ''}
                         onChange={(e) => updatePayment(idx, 'amount', Number(e.target.value))}
                         placeholder="Amount"
                         className="w-full bg-white border-0 pl-7 pr-3 py-2 rounded-xl text-xs font-black outline-none shadow-sm"
                       />
                    </div>
                    {payments.length > 1 && (
                      <button onClick={() => removePayment(idx)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors">
                         <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div className={`p-4 rounded-2xl flex justify-between items-center ${isSufficientPaid ? 'bg-emerald-50 border border-emerald-100' : 'bg-amber-50 border border-amber-100'}`}>
                 <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Collected Total</span>
                 <span className={`text-lg font-black italic ${isSufficientPaid ? 'text-emerald-600' : 'text-amber-600'}`}>
                   ₹{payments.reduce((sum, p) => sum + p.amount, 0)}
                 </span>
              </div>

              <button 
                onClick={handleSettle}
                disabled={processing || !isSufficientPaid}
                className="w-full bg-slate-900 text-white font-black py-6 rounded-2xl flex items-center justify-center gap-3 shadow-2xl hover:bg-black active:scale-[0.98] transition-all uppercase tracking-widest text-sm disabled:opacity-30"
              >
                {processing ? <Loader2 size={20} className="animate-spin" /> : <CheckCircle size={20} />}
                {processing ? 'Settling...' : 'Settle Payment'}
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setShowSettlement(true)}
              className="w-full bg-indigo-600 text-white font-black py-6 rounded-2xl flex items-center justify-center gap-3 shadow-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all uppercase tracking-widest text-sm"
            >
              <CreditCard size={20} />
              Proceed To Settlement
            </button>
          )
        ) : (
          <button 
            onClick={handleGenerateBill}
            disabled={processing}
            className="w-full bg-indigo-600 text-white font-black py-6 rounded-2xl flex items-center justify-center gap-3 shadow-2xl hover:bg-indigo-700 active:scale-[0.98] transition-all uppercase tracking-widest text-sm disabled:opacity-50"
          >
            {processing ? <Loader2 size={20} className="animate-spin" /> : <Receipt size={20} />}
            {processing ? 'Generating...' : 'Finalize & Move To Pending'}
          </button>
        )}
      </div>
    </div>
  );
};


export default Billing;
