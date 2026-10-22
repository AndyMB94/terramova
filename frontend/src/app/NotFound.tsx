import { Link } from "react-router";

export function NotFound() {
  return (
    <main className="mx-auto max-w-xl px-5 py-16 text-center">
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <p className="mt-3">
        <Link to="/" className="text-primary hover:underline">
          Ir a explorar
        </Link>
      </p>
    </main>
  );
}
