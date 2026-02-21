import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ToastProvider } from './components/Toast';
import Home from './pages/Home';
import Mailbox from './pages/Mailbox';

const App = () => (
  <BrowserRouter>
    <ToastProvider>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/mailbox" element={<Mailbox />} />
      </Routes>
    </ToastProvider>
  </BrowserRouter>
);

export default App;
