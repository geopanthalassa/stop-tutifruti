import "./globals.css";

export const metadata = {
  title: "Stop / Tutifruti",
  description: "Juego de categorías y letras — local u online con amigos.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
