'use client';

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-xl font-bold mb-4">Ocurrió un error inesperado</h2>
      <button
        type="button"
        onClick={() => reset()}
        className="px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
