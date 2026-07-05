import './styles.css';
import type { ReactNode } from 'react';

export const metadata = {
  title: 'Symplex Fest',
  description: 'Sistema simples para venda, validação e gestão de tickets de festas.',
  manifest: '/manifest.json',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#111827" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body>{children}</body>
    </html>
  );
}
