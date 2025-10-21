import { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';
import { QRCodeSVG } from 'qrcode.react';
import * as bip39 from 'bip39'; // npm install bip39
import * as bitcoin from 'bitcoinjs-lib'; // npm install bitcoinjs-lib
import * as hdkey from 'hdkey'; // npm install hdkey

const API_BASE = '';  // Relative path—proxied to https://sendmoon.xyz/api

// Dogecoin network config for bitcoinjs-lib
const DOGE_NETWORK = {
  messagePrefix: '\x19Dogecoin Signed Message:\n',
  bech32: 'bc',
  bip32: {
    public: 0x02facafd,
    private: 0x02fac398,
  },
  pubKeyHash: 0x1e, // Starts with 'D'
  scriptHash: 0x16,
  wif: 0x9e,
};

function ClaimPage() {
  const [generatedMnemonic, setGeneratedMnemonic] = useState(null);
  const [generatedAddress, setGeneratedAddress] = useState(null);
  const [isMounted, setIsMounted] = useState(false);  // Add mounted state to delay toast
  const [showClaimToast, setShowClaimToast] = useState(false);  // New state for toast timing
  const claimForm = useForm({
    mode: 'onBlur'
  });

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Handle URL param for claim code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && isMounted) {
      claimForm.setValue('code', code);
      setShowClaimToast(true);  // Trigger toast via state
    }
  }, [isMounted, claimForm]);

  // New effect: Fire toast after state update (post-render), with safety check
  useEffect(() => {
    if (showClaimToast && toast && typeof toast.info === 'function') {
      toast.info('Claim mode activated with your gift code!');
      setShowClaimToast(false);
    }
  }, [showClaimToast]);

  const generateWallet = () => {
    try {
      // Generate 12-word mnemonic (128 bits entropy)
      const mnemonic = bip39.generateMnemonic(128);
      setGeneratedMnemonic(mnemonic);

      // Derive seed from mnemonic
      const seed = bip39.mnemonicToSeedSync(mnemonic);

      // Derive master key using BIP32
      const master = hdkey.fromMasterSeed(seed);

      // BIP44 path for Dogecoin: m/44'/3'/0'/0/0 (coin type 3 for DOGE)
      const path = "m/44'/3'/0'/0/0";
      const derived = master.derive(path);

      // Get public key
      const publicKey = derived.publicKey;

      // Generate address using bitcoinjs-lib with DOGE network
      const { address } = bitcoin.payments.p2pkh({
        pubkey: publicKey,
        network: DOGE_NETWORK,
      });

      setGeneratedAddress(address);
      claimForm.setValue('recipient_address', address);
      if (toast && typeof toast.success === 'function') {
        toast.success('New wallet generated! Backup your mnemonic securely.');
      }
    } catch (err) {
      if (toast && typeof toast.error === 'function') {
        toast.error('Wallet generation failed: ' + err.message);
      }
    }
  };

  const onClaim = async (data) => {
    try {
      const res = await axios.post(`${API_BASE}/api/claim`, data);
      if (toast && typeof toast.success === 'function') {
        toast.success(`Claimed! Tx: ${res.data.tx_hash}`);
      }
      claimForm.reset();
      setGeneratedMnemonic(null);
      setGeneratedAddress(null);
    } catch (err) {
      if (toast && typeof toast.error === 'function') {
        toast.error(err.response?.data?.error || 'Claim failed');
      }
    }
  };

  return (
    <div className="min-h-screen space-stars bg-gradient-to-br from-space-gradient-start via-space-gradient-end to-space-bg text-space-secondary flex flex-col items-center justify-center p-4 font-sans">
      <header className="text-4xl font-display font-bold mb-8 text-space-primary drop-shadow-lg [filter:drop-shadow(0_0_10px_rgba(59,130,246,0.3))]">SendMoon 🚀</header>
      <div className="w-full max-w-md bg-space-glass backdrop-blur-[var(--backdrop-blur)] rounded-xl p-6 shadow-lg border border-white/10">
        <form onSubmit={claimForm.handleSubmit(onClaim)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 text-space-secondary">
              Claim Code <span className="text-space-error">*</span>
            </label>
            <input 
              {...claimForm.register('code', { required: 'Claim code is required' })} 
              className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50" 
              placeholder="Enter your gift code"
            />
            {claimForm.formState.errors.code && <p className="text-space-error text-sm mt-1">{claimForm.formState.errors.code.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-space-secondary">Options to Receive Your Gift</label>
            <button
              type="button"
              onClick={generateWallet}
              className="w-full bg-space-success hover:bg-opacity-90 py-3 rounded-lg font-display font-semibold transition-all duration-200 shadow-space-glow hover:shadow-lg transform hover:-translate-y-0.5 mb-3"
            >
              Generate New DOGE Wallet 🌕
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
              Your DOGE Address (starts with D) {generatedAddress && <span className="text-space-success">(Auto-filled)</span>}
            </label>
            <input
              {...claimForm.register('recipient_address', {
                required: !generatedAddress ? 'DOGE address is required' : false,
                pattern: { 
                  value: /^D[1-9A-HJ-NP-Za-km-z]{33}$/, 
                  message: 'Invalid DOGE address (must start with D and be 34 chars)' 
                }
              })}
              className="w-full p-3 bg-transparent border border-white/30 rounded-lg focus:border-space-primary focus:outline-none transition-all duration-200 text-space-secondary placeholder:text-white/40 hover:border-white/50" 
              placeholder="DYourDogeAddressHere..."
            />
            {claimForm.formState.errors.recipient_address && <p className="text-space-error text-sm mt-1">{claimForm.formState.errors.recipient_address.message}</p>}
          </div>
          <button 
            type="submit" 
            className="w-full bg-space-primary hover:bg-opacity-90 py-3 rounded-lg font-display font-semibold transition-all duration-200 shadow-space-glow hover:shadow-lg transform hover:-translate-y-0.5"
          >
            Claim Your DOGE 🚀
          </button>
        </form>
      </div>
      <Toaster /> 
    </div>
  );
}

export default ClaimPage;
