import "./globals.css";

export const metadata = {
  title: "Entrevista de práctica",
  description:
    "Practicá una entrevista de trabajo antes de la de verdad. Ocho preguntas, devolución al final. Nadie ve tus respuestas.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#FBFAF7",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es-AR">
      <body>{children}</body>
    </html>
  );
}
