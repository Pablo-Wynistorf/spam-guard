const ShinyText = ({ text, className = '', speed = 3 }) => {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-[length:200%_100%] animate-[shine_linear_infinite] ${className}`}
      style={{
        backgroundImage: 'linear-gradient(120deg, rgba(156,163,175,0.6) 40%, rgba(255,255,255,1) 50%, rgba(156,163,175,0.6) 60%)',
        animationDuration: `${speed}s`,
      }}
    >
      {text}
      <style>{`
        @keyframes shine {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}</style>
    </span>
  );
};

export default ShinyText;
