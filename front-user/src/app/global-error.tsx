'use client';

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es">
      <body className="bg-gray-950 text-white flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-4">Algo salió mal</h2>
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
          >
            Intentar de nuevo
          </button>
        </div>
      </body>
    </html>
  );
}
