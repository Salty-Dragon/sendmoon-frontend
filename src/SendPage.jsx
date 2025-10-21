// src/SendPage.jsx
import { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';

const API_BASE = '';  // Relative path—proxied to https://sendmoon.xyz/api

function SendPage() {
  const [memecoins, setMemecoins] = useState([]);
  const [balance, setBalance] = useState(0);
  const [feeData, setFeeData] = useState({ feeDoge: 0, feeUsd: 0 });
  const [status, setStatus] = useState(null);
  const [claimCodeAfterPay, setClaimCodeAfterPay] = useState(null);
  const [processingGiftId, setProcessingGiftId] = useState(null);
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm({
    mode: 'onBlur'
  });

  const amount = watch('amount');

  const dogePrice = memecoins[0]?.price_usd || 0;
  const usdValue = parseFloat(amount || 0) * dogePrice;
  const maxUsd = 10;  // Beta cap (consider fetching from /api/config for dynamic)
  const maxAmountUsd = dogePrice > 0 ? maxUsd / dogePrice : 0;  // Dynamic max in DOGE
  const maxAmountPool = Math.max(0, balance - feeData.feeDoge);  // Ensure non-negative
  const effectiveMax = Math.min(maxAmountUsd, maxAmountPool);  // No 10k—covered

  const totalUsd = usdValue + 1 + feeData.feeUsd;

  useEffect(() => {
    fetchMemecoins();
    fetchFee();
  }, []);

  const fetchMemecoins = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/memecoins`);
      setMemecoins(res.data.memecoins);
    } catch (err) {
      if (typeof toast?.error === 'function') {
        toast.error('Failed to load memecoins');
      } else {
        console.error('Failed to load memecoins');
      }
    }
  };

  const fetchFee = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/doge-fee-usd`);
      setFeeData(res.data);
    } catch (err) {
      if (typeof toast?.error === 'function') {
        toast.error('Failed to load fee estimate');
      } else {
        console.error('Failed to load fee estimate');
      }
    }
  };

  useEffect(() => {
    if (memecoins[0]?.symbol === 'DOGE') {
      fetchBalance('DOGE');
    }
  }, [memecoins]);

  const fetchBalance = async (coin) => {
    try {
      const res = await axios.get(`${API_BASE}/api/pools/${coin}/balance`);
      setBalance(res.data.balance);
    } catch (err) {
      if (typeof toast?.error === 'function') {
        toast.error('Failed to load balance');
      } else {
        console.error('Failed to load balance');
      }
    }
  };

  const onSend = async (data) => {
    try {
      const res = await axios.post(`${API_BASE}/api/gifts`, {
        ...data,
        delivery_method: 'EMAIL',
      });
      if (res.data.success) {
        setProcessingGiftId(res.data.gift_id);
        setClaimCodeAfterPay(res.data.claim_code);  // Show code immediately, as it's generated upfront
        window.open(res.data.checkoutLink, '_blank');
        if (typeof toast?.success === 'function') {
          toast.success('Pay the invoice in the new tab. Recipient will be notified automatically once confirmed!');
        } else {
          console.log('Pay the invoice in the new tab. Recipient will be notified automatically once confirmed!');
        }
        reset();
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Send failed';
      if (typeof toast?.error === 'function') {
        toast.error(errorMsg);
      } else {
        console.error(errorMsg);
      }
    }
  };

  // Optional: Add a status check button or auto-refresh for the gift
  const checkGiftStatus = async () => {
    if (!processingGiftId) return;
    try {
      // You'd need a new endpoint like GET /api/gift-status/:id returning status
      // For now, placeholder—implement if desired
      if (typeof toast?.info === 'function') {
        toast.info('Gift processing... Check email for updates.');
      } else {
        console.info('Gift processing... Check email for updates.');
      }
    } catch (err) {
      if (typeof toast?.error === 'function') {
        toast.error('Status check failed');
      } else {
        console.error('Status check failed');
      }
    }
  };

  const networkFeeDisplay = feeData.feeUsd < 0.01 ? 'Under 1 cent' : `$${feeData.feeUsd.toFixed(4)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-space-gradient-start via-space-gradient-end to-space-bg text-space-secondary flex flex-col items-center justify-center p-4 font-sans">
      <header className="text-4xl font-display font-bold mb-8 text-space-primary drop-shadow-lg [filter:drop-shadow(0_0_10px_rgba(59,130,246,0.3))]">SendMoon 🚀</header>
      <div className="w-full max-w-md bg-space-glass backdrop-blur-[var(--backdrop-blur)] rounded-xl p-6 shadow-lg border border-white/10">
        <form onSubmit={handleSubmit(onSend)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-space-secondary">
              Amount (DOGE) <span className="text-xs text-white/70">(Max: {Number.isFinite(effectiveMax) ? effectiveMax.toFixed(8) : '0'} DOGE | ~${maxUsd} USD beta limit)</span>
            </label>
            <input 
              type="number" 
              step="any" 
              {...register('amount', { 
                required: true, 
                min: 0.01
              })} 
              className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50" 
              placeholder="Enter amount in DOGE"
            />
            {errors.amount && <p className="text-space-error text-sm mt-1">{errors.amount.message || 'Invalid amount'}</p>}
            {usdValue > maxUsd && !errors.amount && (
              <p className="text-space-error text-xs mt-1">Exceeds beta ${maxUsd} USD limit.</p>
            )}
            {parseFloat(amount || 0) > maxAmountPool && (
              <p className="text-space-warning text-xs mt-1">Exceeds available pool balance.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-space-secondary">
              Recipient Email <span className="text-space-error">*</span>
            </label>
            <input 
              type="email" 
              {...register('recipient_email', { 
                required: 'Email is required',
                pattern: {
                  value: /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
                  message: 'Invalid email address'
                }
              })} 
              placeholder="email@example.com" 
              className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50" 
            />
            {errors.recipient_email && <p className="text-space-error text-sm mt-1">{errors.recipient_email.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-space-secondary flex items-center">
              Sender Name (Optional)
              <span className="ml-1 relative group">
                <span className="text-space-primary cursor-help text-sm">ℹ️</span>
                <div className="absolute left-0 -top-8 w-64 bg-black/90 text-space-secondary text-xs p-2 rounded shadow-space-glow opacity-0 invisible group-hover:opacity-100 group-hover:visible z-10 whitespace-pre-wrap border border-white/10">
                  The recipient is more likely to accept the gift if they know who is sending it. Can be a name or even a social media handle they know.
                </div>
              </span>
            </label>
            <input 
              {...register('sender_name')} 
              className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50" 
              placeholder="Your name or @handle"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-space-secondary flex items-center">
              Message (Optional)
              <span className="ml-1 relative group">
                <span className="text-space-primary cursor-help text-sm">ℹ️</span>
                <div className="absolute left-0 -top-8 w-64 bg-black/90 text-space-secondary text-xs p-2 rounded shadow-space-glow opacity-0 invisible group-hover:opacity-100 group-hover:visible z-10 whitespace-pre-wrap border border-white/10">
                  This message will be included in the recipients email notification.
                </div>
              </span>
            </label>
            <textarea 
              {...register('message')} 
              rows="3"
              className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50 resize-vertical" 
              placeholder="A surprise from the stars..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 text-space-secondary flex items-center">
              Return Address (Optional)
              <span className="ml-1 relative group">
                <span className="text-space-primary cursor-help text-sm">ℹ️</span>
                <div className="absolute left-0 -top-8 w-64 bg-black/90 text-space-secondary text-xs p-2 rounded shadow-space-glow opacity-0 invisible group-hover:opacity-100 group-hover:visible z-10 whitespace-pre-wrap border border-white/10">
                  If a gift is not claimed after 7 days, your gift will be returned.
                </div>
              </span>
            </label>
            <input 
              {...register('return_address')} 
              placeholder="Your DOGE address for returns" 
              className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50" 
            />
          </div>
          {amount && (
            <div className="text-sm text-space-success bg-black/20 p-3 rounded-lg space-y-1">
              <p className="font-medium">Total cost: ${Number.isFinite(totalUsd) ? totalUsd.toFixed(2) : '0.00'} USD</p>
              <ul className="text-xs space-y-0.5 list-disc list-inside">
                <li>DOGE: ${Number.isFinite(usdValue) ? usdValue.toFixed(4) : '0.0000'}</li>
                <li>Platform Fee: $1</li>
                <li>Network: {networkFeeDisplay}</li>
              </ul>
              {usdValue > (maxUsd * 0.8) && (  // Warn if >80% of cap
                <p className="text-space-warning text-xs mt-1">Approaching beta limit—max ${maxUsd} USD.</p>
              )}
            </div>
          )}
          {processingGiftId && <p className="text-center text-space-warning bg-black/20 p-2 rounded-lg">Gift created! Payment processing via webhook. Recipient notified on confirmation.</p>}
          <button 
            type="submit" 
            disabled={processingGiftId} 
            className="w-full bg-space-primary hover:bg-opacity-90 py-3 rounded-lg font-display font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-space-glow hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Send 🚀
          </button>
          <p className="text-xs text-white/60 text-center">You will be directed to our BTCPay server to complete payment in LTC or BTC when you press "Send".</p>
          {claimCodeAfterPay && (
            <div className="mt-4 text-center bg-black/10 p-4 rounded-lg border border-white/10">
              <p className="text-space-secondary mb-2">Gift ready! Claim Code (share if needed):</p>
              <p className="font-mono text-space-primary bg-black/20 p-2 rounded mb-3">{claimCodeAfterPay}</p>
              <QRCodeSVG value={`https://sendmoon.xyz/claim?code=${claimCodeAfterPay}`} size={128} className="mx-auto filter drop-shadow-[0_0_15px_rgba(59,130,246,0.3)]" />
              <p className="text-xs text-white/60 mt-2">Notification sends automatically after payment.</p>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

export default SendPage;
