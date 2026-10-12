import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-bold mb-2">Página no encontrada</h2>
      <p className="text-gray-400 mb-6 text-sm">No pudimos encontrar el recurso solicitado.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-cyan-500 text-black font-semibold rounded-lg hover:bg-cyan-400 transition-colors"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
