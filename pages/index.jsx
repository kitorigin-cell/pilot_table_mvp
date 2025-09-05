import Link from 'next/link';
export default function Home(){
return (
<main className="min-h-screen flex items-center justify-center">
<div className="max-w-xl text-center p-6">
<img src="/airplane.svg" alt="plane" width={72} className="mx-auto
mb-4" />
<h1 className="text-2xl font-bold mb-2">Telegram MiniApp — Flights</
h1>
<p className="mb-4">Запустите бота в Telegram, откройте миниприложение и управляйте рейсами.</p>
<Link href="/webapp"><a className="px-4 py-2 bg-sky-600 text-white
rounded">Open WebApp</a></Link>
</div>
</main>
);
}
