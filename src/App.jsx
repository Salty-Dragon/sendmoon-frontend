import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SendPage from './SendPage';
import ClaimPage from './ClaimPage';
import AdminDashboard from './admin/AdminDashboard';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <Router>
      <Toaster />
      <Routes>
        <Route path="/" element={<SendPage />} />
        <Route path="/claim" element={<ClaimPage />} />
        <Route path="/admin" element={<AdminDashboard />} /> {/* Add this line */}
      </Routes>
    </Router>
  );
}

export default App;
