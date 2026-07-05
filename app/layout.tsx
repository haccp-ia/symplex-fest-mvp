import type { ReactNode } from 'react';
import './styles.css';

export const metadata = {
  title: 'Symplex Fest MVP',
  description: 'MVP de tickets, barracas, caixa, dashboard e repasse financeiro.'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
