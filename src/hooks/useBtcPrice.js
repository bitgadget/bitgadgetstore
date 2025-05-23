import { useState, useEffect } from 'react';
import create from 'zustand';

const useBtcStore = create(set => ({ price: null, setPrice: p => set({ price: p }) }));

export function useBtcPrice() {
  const { price, setPrice } = useBtcStore();

  useEffect(() => {
    async function fetchPrice() {
      try {
        const res = await fetch('https://api.kraken.com/0/public/Ticker?pair=XXBTZUSD');
        const data = await res.json();
        const p = parseFloat(data.result.XXBTZUSD.c[0]);
        setPrice(p);
      } catch (err) {
        console.error('Errore fetching BTC price:', err);
      }
    }
    fetchPrice();
    const interval = setInterval(fetchPrice, 30000);
    return () => clearInterval(interval);
  }, [setPrice]);

  return price;
}