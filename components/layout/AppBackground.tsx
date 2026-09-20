interface AppBackgroundProps {
  immersive?: boolean;
}

export function AppBackground({ immersive = false }: AppBackgroundProps) {
  if (immersive) {
    return (
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden bg-[#02040b]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(50,79,164,0.16),transparent_36%),radial-gradient(circle_at_82%_18%,rgba(116,63,182,0.10),transparent_31%),linear-gradient(145deg,#030714_0%,#07101f_48%,#02040b_100%)]" />
        <div className="absolute top-[-18%] left-[-10%] h-[58vw] w-[58vw] rounded-full bg-blue-700/10 blur-[140px]" />
        <div className="absolute bottom-[-22%] right-[-12%] h-[55vw] w-[55vw] rounded-full bg-violet-700/10 blur-[150px]" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute top-[-10%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-blue-300/30 blur-[120px]" />
      <div className="absolute bottom-[5%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-indigo-300/20 blur-[150px]" />
      <div className="absolute top-[30%] right-[15%] w-[45vw] h-[45vw] rounded-full bg-pink-200/25 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[10%] w-[50vw] h-[50vw] rounded-full bg-sky-200/35 blur-[140px]" />
    </div>
  );
}
