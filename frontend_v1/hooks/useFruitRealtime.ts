'use client';

import { useEffect, useState } from 'react';
import { fruitStore, FruitSession } from '@/lib/scada-fruit-store';

export function useFruitRealtime() {
  const [data, setData] = useState<FruitSession[]>([]);

  useEffect(() => {
    return fruitStore.subscribe(setData);
  }, []);

  return data;
}