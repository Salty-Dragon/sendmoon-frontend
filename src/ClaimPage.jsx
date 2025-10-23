import { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import * as bip39 from 'bip39';
import * as bitcoin from 'bitcoinjs-lib';
import * as hdkey from 'hdkey';

// Import Turnstile component
import Turnstile from 'react-cloudflare-turnstile';

// Read Turnstile site key from environment
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

const API_BASE = '';  // Relative path—proxied to https://sendmoon.xyz/api

const NETWORKS = {
  DOGE: {
    messagePrefix: '\x19Dogecoin Signed Message:\n',
    bech32: 'bc',
    bip32: {
      public: 0x02facafd,
      private: 0x02fac398,
    },
    pubKeyHash: 0x1e, // Starts with 'D'
    scriptHash: 0x16,
    wif: 0x9e,
    explorerBase: 'https://dogechain.info/tx/',
  },
  TRMP: {
    messagePrefix: '\x19Trumpow Signed Message:\n',
    bech32: 'bc',
    bip32: {
      public: 0x02facafd,
      private: 0x02fac398,
    },
    pubKeyHash: 0x41, // Starts with 'T'
    scriptHash: 0x16,
    wif: 0x9e,
    explorerBase: 'https://explorer.trumpow.meme/tx/',
  },
};

function ClaimPage() {
  const [generatedMnemonic, setGeneratedMnemonic] = useState(null);
  const [generatedAddress, setGeneratedAddress] = useState(null);
  const [giftInfo, setGiftInfo] = useState(null); // Holds symbol, amount, sender_name, etc.
  const [loadingGift, setLoadingGift] = useState(true);
  const [showClaimToast, setShowClaimToast] = useState(false);
  const [claimedTx, setClaimedTx] = useState(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const claimForm = useForm({ mode: 'onBlur' });

  // Fetch gift info (symbol, amount, etc) by claim code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      claimForm.setValue('code', code);
      setLoadingGift(true);
      axios.get(`${API_BASE}/api/claim-info?code=${code}`)
        .then(res => {
          setGiftInfo(res.data);
          setShowClaimToast(true);
        })
        .catch(() => {
          toast.error('Invalid or expired claim code');
          setGiftInfo(null);
        })
        .finally(() => setLoadingGift(false));
    } else {
      setLoadingGift(false);
    }
    // eslint-disable-next-line
  }, [claimForm]);

  useEffect(() => {
    if (showClaimToast && toast && typeof toast.info === 'function') {
      toast.info('Claim mode activated with your gift code!');
      setShowClaimToast(false);
    }
  }, [showClaimToast]);

  // Wallet generation
  const generateWallet = () => {
    if (!giftInfo?.symbol) return toast.error('No memecoin info.');
    const symbol = giftInfo.symbol.toUpperCase();
    const network = NETWORKS[symbol] || NETWORKS.DOGE;
    try {
      const mnemonic = bip39.generateMnemonic(128);
      setGeneratedMnemonic(mnemonic);

      const seed = bip39.mnemonicToSeedSync(mnemonic);
      const master = hdkey.fromMasterSeed(seed);

      // Use DOGE's coin type (3) for both DOGE and TRMP for now
      const coinType = 3;
      const path = `m/44'/${coinType}'/0'/0/0`;
      const derived = master.derive(path);

      const publicKey = derived.publicKey;

      const { address } = bitcoin.payments.p2pkh({
        pubkey: publicKey,
        network,
      });

      setGeneratedAddress(address);
      claimForm.setValue('recipient_address', address);
      toast.success(`New ${symbol} wallet generated! Backup your mnemonic securely.`);
    } catch (err) {
      toast.error('Wallet generation failed: ' + err.message);
    }
  };

  // Claim submit handler
  const onClaim = async (data) => {
    if (!giftInfo?.symbol) return toast.error('Memecoin info missing');
    if (!turnstileToken) {
      toast.error('Please complete the bot check before submitting.');
      return;
    }
    try {
      const res = await axios.post(`${API_BASE}/api/${giftInfo.symbol}/claim`, {
        ...data,
        turnstileToken, // Include Turnstile token
      });
      setClaimedTx({
        tx_hash: res.data.tx_hash,
        explorer: res.data.explorer,
        amount: giftInfo.amount,
        symbol: giftInfo.symbol,
        address: data.recipient_address,
      });
      claimForm.reset();
      setGeneratedMnemonic(null);
      setGeneratedAddress(null);
      setTurnstileToken('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Claim failed');
    }
  };

  // UI logic
  const symbol = giftInfo?.symbol?.toUpperCase() || 'DOGE';
  const coinName = symbol === 'TRMP' ? 'TRMP' : 'DOGE';
  const addressLabel = symbol === 'TRMP'
    ? 'Your TRMP Address (starts with T)'
    : 'Your DOGE Address (starts with D)';
  const addressPattern = symbol === 'TRMP'
    ? /^T[1-9A-HJ-NP-Za-km-z]{33}$/
    : /^D[1-9A-HJ-NP-Za-km-z]{33}$/;

  // Combined message logic
  let topMessage = null;
  if (claimedTx) {
    topMessage = (
      <div className="mb-4 text-space-success text-center bg-black/30 p-4 rounded-lg border border-space-success">
        You have claimed <b>{claimedTx.amount} {claimedTx.symbol}</b> and it has been sent to your {claimedTx.symbol} address!
        <br />
        Transaction:{' '}
        <a
          href={claimedTx.explorer}
          target="_blank"
          rel="noopener noreferrer"
          className="text-space-primary underline break-all font-mono"
        >
          {claimedTx.tx_hash}
        </a>
      </div>
    );
  } else if (giftInfo) {
    topMessage = (
      <div className="mb-4 text-space-success text-center bg-black/30 p-4 rounded-lg border border-space-success">
        Claiming <b>{giftInfo.amount} {coinName}</b>
        {giftInfo.sender_name && <> from <b>{giftInfo.sender_name}</b></>}
        !
      </div>
    );
  }

  if (loadingGift) return (
    <div className="min-h-screen flex items-center justify-center text-space-secondary bg-gradient-to-br from-space-gradient-start via-space-gradient-end to-space-bg">
      <span className="text-xl font-bold">Loading gift info...</span>
      <Toaster />
    </div>
  );

  if (!giftInfo) return (
    <div className="min-h-screen flex items-center justify-center text-space-error bg-gradient-to-br from-space-gradient-start via-space-gradient-end to-space-bg">
      <span className="text-xl font-bold">Invalid or expired claim code.</span>
      <Toaster />
    </div>
  );

  return (
    <div className="min-h-screen space-stars bg-gradient-to-br from-space-gradient-start via-space-gradient-end to-space-bg text-space-secondary flex flex-col items-center justify-center p-4 font-sans">
      <header className="text-4xl font-display font-bold mb-8 text-space-primary drop-shadow-lg [filter:drop-shadow(0_0_10px_rgba(59,130,246,0.3))]">
        SendMoon 🚀
      </header>
      <div className="w-full max-w-md bg-space-glass backdrop-blur-[var(--backdrop-blur)] rounded-xl p-6 shadow-lg border border-white/10">
        {topMessage}
        {!claimedTx && (
          <form onSubmit={claimForm.handleSubmit(onClaim)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1 text-space-secondary">
                Claim Code <span className="text-space-error">*</span>
              </label>
              <input
                {...claimForm.register('code', { required: 'Claim code is required' })}
                className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50"
                placeholder="Enter your gift code"
                disabled={!!giftInfo}
                value={giftInfo.claim_code || claimForm.getValues('code')}
                readOnly
              />
              {claimForm.formState.errors.code && (
                <p className="text-space-error text-sm mt-1">{claimForm.formState.errors.code.message}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium mb-2 text-space-secondary">Options to Receive Your Gift</label>
              <button
                type="button"
                onClick={generateWallet}
                className="w-full bg-space-success hover:bg-opacity-90 py-3 rounded-lg font-display font-semibold transition-all duration-200 shadow-space-glow hover:shadow-lg transform hover:-translate-y-0.5 mb-3"
              >
                Generate New {coinName} Wallet 🌕
              </button>
              {generatedMnemonic && (
                <div className="bg-black/30 p-3 rounded-lg text-sm mb-3 border border-white/20">
                  <p className="font-medium text-space-secondary mb-1"><strong>Mnemonic (Backup this!):</strong></p>
                  <p className="font-mono text-space-primary break-all mb-1 bg-black/50 p-2 rounded text-xs">{generatedMnemonic}</p>
                  <p className="font-medium text-space-secondary mb-1"><strong>Address:</strong></p>
                  <p className="font-mono text-space-primary break-all bg-black/50 p-2 rounded text-xs">{generatedAddress}</p>
                  <p className="text-space-warning text-xs mt-2">Never share your mnemonic!</p>
                </div>
              )}
              <label className="block text-sm font-medium mb-1 text-space-secondary">
                {addressLabel} {generatedAddress && <span className="text-space-success">(Auto-filled)</span>}
              </label>
              <input
                {...claimForm.register('recipient_address', {
                  required: !generatedAddress ? `${coinName} address is required` : false,
                  pattern: {
                    value: addressPattern,
                    message: `Invalid ${coinName} address (must start with ${symbol === 'TRMP' ? 'T' : 'D'} and be 34 chars)`
                  }
                })}
                className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50"
                placeholder={symbol === 'TRMP' ? "TYourTrmpAddressHere..." : "DYourDogeAddressHere..."}
              />
              {claimForm.formState.errors.recipient_address && (
                <p className="text-space-error text-sm mt-1">{claimForm.formState.errors.recipient_address.message}</p>
              )}
            </div>
            {/* Turnstile widget for bot protection */}
            <div className="my-3 flex items-center justify-center">
              <Turnstile
                sitekey={TURNSTILE_SITE_KEY}
                onSuccess={setTurnstileToken}
                theme="dark"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-space-primary hover:bg-opacity-90 py-3 rounded-lg font-display font-semibold transition-all duration-200 shadow-space-glow hover:shadow-lg transform hover:-translate-y-0.5"
            >
              Claim Your {coinName} 🚀
            </button>
          </form>
        )}
      </div>
      <Toaster />
    </div>
  );
}

export default ClaimPage;
