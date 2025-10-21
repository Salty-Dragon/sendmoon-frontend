// src/App.jsx
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SendPage from './SendPage';
import ClaimPage from './ClaimPage';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Router>
      <Toaster />
      <Routes>
        <Route path="/" element={<SendPage />} />
        <Route path="/claim" element={<ClaimPage />} />
      </Routes>
    </Router>
  );
}

export default App;
