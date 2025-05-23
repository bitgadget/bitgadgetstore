import React from 'react';
import { useBtcPrice } from '../hooks/useBtcPrice';

export default function Header() {
  const btcPrice = useBtcPrice();

  return (
    <header className="bg-darkAnthracite text-white p-4 flex items-center justify-between">
      <div className="flex items-center">
        <img src="/logo.png" alt="Logo" className="h-8 mr-2" />
        <nav className="space-x-4">
          <a href="/" className="hover:underline">Home</a>
          <a href="/products" className="hover:underline">Prodotti</a>
          <a href="/blog" className="hover:underline">Blog</a>
        </nav>
      </div>
      <div className="flex items-center space-x-6">
        {btcPrice !== null && (
          <span className="font-semibold">BTC/USD: ${btcPrice.toLocaleString()}</span>
        )}
        <a href="/cart" className="relative">
          🛒
        </a>
      </div>
    </header>
  );
}