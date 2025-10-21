import { useState, useEffect } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
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

function App() {
  const [tab, setTab] = useState('send'); // 'send' or 'claim'
  const [memecoins, setMemecoins] = useState([]);
  const [balance, setBalance] = useState(0);
  const [claimCode, setClaimCode] = useState(null); // For displaying after send
  const [generatedMnemonic, setGeneratedMnemonic] = useState(null);
  const [generatedAddress, setGeneratedAddress] = useState(null);
  const { register, handleSubmit, formState: { errors }, reset, watch, setValue } = useForm();
  const claimForm = useForm();

  const selectedCoin = watch('coin');
  const deliveryMethod = watch('delivery_method');
  const amount = watch('amount');

  const selectedMemecoin = memecoins.find(coin => coin.symbol === selectedCoin);
  const priceUsd = selectedMemecoin?.price_usd || 0;

  // Handle URL param for claim code
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code) {
      setTab('claim');
      claimForm.setValue('code', code);
      toast.info('Claim mode activated with your gift code!');
    }
  }, []);

  useEffect(() => {
    fetchMemecoins();
  }, []);

  const fetchMemecoins = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/memecoins`);
      setMemecoins(res.data.memecoins);
      if (res.data.memecoins.length > 0) {
        setValue('coin', res.data.memecoins[0].symbol);
      }
      setValue('delivery_method', 'email');
    } catch (err) {
      toast.error('Failed to load memecoins');
    }
  };

  useEffect(() => {
    if (selectedCoin) {
      fetchBalance(selectedCoin);
    }
  }, [selectedCoin]);

  const fetchBalance = async (coin) => {
    try {
      const res = await axios.get(`${API_BASE}/api/pools/${coin}/balance`);
      setBalance(res.data.balance);
    } catch (err) {
      toast.error('Failed to load balance');
    }
  };

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
      toast.success('New wallet generated! Backup your mnemonic securely.');
    } catch (err) {
      toast.error('Wallet generation failed: ' + err.message);
    }
  };

  const onSend = async (data) => {
    try {
      const res = await axios.post(`${API_BASE}/api/gifts`, {
        ...data,
        delivery_method: data.delivery_method.toUpperCase(),
      });
      setClaimCode(res.data.claim_code);
      toast.success('Gift sent successfully!');
      reset();
      fetchBalance(data.coin); // Update after reserve
    } catch (err) {
      toast.error(err.response?.data?.error || 'Send failed');
    }
  };

  const onClaim = async (data) => {
    try {
      const res = await axios.post(`${API_BASE}/api/claim`, data);
      toast.success(`Claimed! Tx: ${res.data.tx_hash}`);
      claimForm.reset();
      setGeneratedMnemonic(null);
      setGeneratedAddress(null);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Claim failed');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-indigo-900 text-white flex flex-col items-center justify-center p-4">
      <header className="text-4xl font-bold mb-8">SendMoon 🚀</header>
      <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-xl p-6 shadow-lg">
        <div className="flex mb-4">
          <button onClick={() => setTab('send')} className={`flex-1 py-2 ${tab === 'send' ? 'bg-indigo-600' : 'bg-transparent'}`}>Send Gift</button>
          <button onClick={() => setTab('claim')} className={`flex-1 py-2 ${tab === 'claim' ? 'bg-indigo-600' : 'bg-transparent'}`}>Claim Gift</button>
        </div>

        {tab === 'send' && (
          <form onSubmit={handleSubmit(onSend)} className="space-y-4">
            <div>
              <label>Amount (DOGE)</label>
              <input type="number" step="any" {...register('amount', { required: true, min: 0.01, max: 10000 })} className="w-full p-2 bg-transparent border-b" />
              {errors.amount && <p className="text-red-400">Invalid amount (0.01-10,000)</p>}
              <p className="text-sm">Pool balance: {balance} DOGE</p>
            </div>
            <div>
              <label>Delivery Method</label>
              <select {...register('delivery_method', { required: true })} className="w-full p-2 bg-transparent border-b">
                <option value="email">Email</option>
                <option value="sms">SMS</option>
              </select>
            </div>
            {deliveryMethod === 'email' && (
              <div>
                <label>Recipient Email</label>
                <input type="email" {...register('recipient_email', { required: true })} placeholder="email@example.com" className="w-full p-2 bg-transparent border-b" />
                {errors.recipient_email && <p className="text-red-400">Invalid email</p>}
              </div>
            )}
            {deliveryMethod === 'sms' && (
              <div>
                <label>Recipient Phone</label>
                <input type="tel" {...register('recipient_phone', { required: true, pattern: /^\+[1-9]\d{1,14}$/ })} placeholder="+1234567890" className="w-full p-2 bg-transparent border-b" />
                {errors.recipient_phone && <p className="text-red-400">Invalid phone (e.g., +1234567890)</p>}
              </div>
            )}
            <div>
              <label>Sender Name (Optional)</label>
              <input {...register('sender_name')} className="w-full p-2 bg-transparent border-b" />
            </div>
            <div>
              <label>Message (Optional)</label>
              <textarea {...register('message')} className="w-full p-2 bg-transparent border-b" />
            </div>
            <div>
              <label>Return Address (Optional)</label>
              <input {...register('return_address')} placeholder="Your DOGE address for returns" className="w-full p-2 bg-transparent border-b" />
            </div>
            <button type="submit" className="w-full bg-indigo-600 py-2 rounded">Send 🚀</button>
            {claimCode && (
              <div className="mt-4 text-center">
                <p>Claim Code: {claimCode}</p>
                <QRCodeSVG value={`https://sendmoon.xyz/claim?code=${claimCode}`} size={128} className="mx-auto" />
              </div>
            )}
          </form>
        )}

        {tab === 'claim' && (
          <form onSubmit={claimForm.handleSubmit(onClaim)} className="space-y-4">
            <div>
              <label>Claim Code</label>
              <input {...claimForm.register('code', { required: true })} className="w-full p-2 bg-transparent border-b" />
              {claimForm.formState.errors.code && <p className="text-red-400">Required</p>}
            </div>
            <div>
              <label>Options to Receive Your Gift</label>
              <button
                type="button"
                onClick={generateWallet}
                className="w-full bg-green-600 py-2 rounded mb-2"
              >
                Generate New DOGE Wallet
              </button>
              {generatedMnemonic && (
                <div className="bg-gray-800 p-2 rounded text-sm mb-2">
                  <p><strong>Mnemonic (Backup this!):</strong> {generatedMnemonic}</p>
                  <p><strong>Address:</strong> {generatedAddress}</p>
                  <p className="text-red-400 text-xs">Never share your mnemonic!</p>
                </div>
              )}
              <label>Your DOGE Address (starts with D)</label>
              <input
                {...claimForm.register('recipient_address', {
                  required: !generatedAddress,
                  pattern: { value: /^D[1-9A-HJ-NP-Za-km-z]{33}$/, message: 'Invalid DOGE address' }
                })}
                className="w-full p-2 bg-transparent border-b"
              />
              {claimForm.formState.errors.recipient_address && <p className="text-red-400">{claimForm.formState.errors.recipient_address.message}</p>}
            </div>
            <button type="submit" className="w-full bg-indigo-600 py-2 rounded">Claim 🌕</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default App;
