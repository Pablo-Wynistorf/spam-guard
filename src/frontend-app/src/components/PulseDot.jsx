const PulseDot = ({ color = 'bg-emerald-400' }) => (
  <span className="relative flex h-2.5 w-2.5">
    <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${color}`} />
    <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} />
  </span>
);

export default PulseDot;
