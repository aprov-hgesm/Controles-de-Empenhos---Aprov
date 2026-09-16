export function AppBackground() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
      <div className="absolute top-[-10%] left-[-15%] w-[60vw] h-[60vw] rounded-full bg-blue-300/30 blur-[120px]" />
      <div className="absolute bottom-[5%] right-[-10%] w-[55vw] h-[55vw] rounded-full bg-indigo-300/20 blur-[150px]" />
      <div className="absolute top-[30%] right-[15%] w-[45vw] h-[45vw] rounded-full bg-pink-200/25 blur-[120px]" />
      <div className="absolute bottom-[-10%] left-[10%] w-[50vw] h-[50vw] rounded-full bg-sky-200/35 blur-[140px]" />
    </div>
  );
}
