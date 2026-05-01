export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Soft radial glow behind content */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 70% at 50% 35%, color-mix(in srgb, var(--primary) 13%, transparent), transparent 75%)",
        }}
        aria-hidden="true"
      />
      <div className="relative z-10 w-full max-w-sm">{children}</div>
    </div>
  );
}
