import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SplitText from '../components/SplitText';
import SpotlightCard from '../components/SpotlightCard';
import AnimatedBackground from '../components/AnimatedBackground';
import ShinyText from '../components/ShinyText';
import { useToast } from '../components/Toast';

const Home = () => {
  const navigate = useNavigate();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/create-mailbox', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error('Failed to create mailbox');
      await res.json();
      navigate('/mailbox');
    } catch {
      setError('Error generating email. Try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gray-900 text-gray-100 flex items-center justify-center px-4 overflow-hidden">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-xl">
        <SpotlightCard className="space-y-8" spotlightColor="rgba(59, 130, 246, 0.2)">
          <div className="text-center space-y-3">
            <SplitText
              text="Spam Guard"
              className="text-4xl sm:text-5xl font-bold text-white justify-center flex flex-wrap"
              delay={80}
            />
            <ShinyText
              text="Protect your privacy with a disposable email inbox."
              className="text-sm"
              speed={4}
            />
          </div>

          <div className="flex flex-col gap-4 items-center">
            <button
              onClick={generate}
              disabled={loading}
              className="w-full cursor-pointer bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-blue-500/25"
            >
              {loading ? 'Generating...' : 'Generate Temp Email'}
            </button>

            {error && (
              <p className="text-red-400 text-sm text-center">{error}</p>
            )}

            <p className="text-center text-sm text-gray-500">
              You'll be redirected to your inbox after creation.
            </p>
          </div>
        </SpotlightCard>
      </div>
    </div>
  );
};

export default Home;
