import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#1D9E75] px-6 font-sans">
      <div className="flex w-full max-w-sm flex-col items-center gap-10 text-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="grid size-20 place-items-center rounded-2xl bg-white"
            aria-hidden="true"
          >
            <span className="text-3xl font-extrabold text-[#1D9E75]">ف</span>
          </div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white">
            فطين
          </h1>
        </div>

        <Link
          href="/add"
          className="w-full rounded-2xl bg-white px-6 py-4 text-lg font-semibold text-[#1D9E75] transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          أضف مصروف
        </Link>
        <Link
          href="/expenses"
          className="w-full rounded-2xl border-2 border-white bg-transparent px-6 py-4 text-lg font-semibold text-white transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
        >
          مصاريفي
        </Link>
      </div>
    </main>
  );
}
