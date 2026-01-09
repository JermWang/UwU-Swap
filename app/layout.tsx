import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import SolanaWalletProvider from "./components/SolanaWalletProvider";
import { ToastProvider } from "./components/ToastProvider";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AsciiShaderBackground from "./components/AsciiShaderBackground";

export const metadata = {
  title: "Uwu Swap",
  description: "Privacy-first token transfers on Solana. Send tokens through ephemeral wallet chains to break traceability. Hold $UWU for free transfers!",
  icons: {
    icon: [{ url: "/branding/AI_assistant_avatar.png", type: "image/png" }],
  },
  openGraph: {
    title: "Uwu Swap",
    description: "Privacy-first token transfers on Solana. Send tokens through ephemeral wallet chains to break traceability.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Uwu Swap",
    description: "Privacy-first token transfers on Solana. Send tokens through ephemeral wallet chains to break traceability.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body data-skin="uwu">
        <AsciiShaderBackground />
        <SolanaWalletProvider>
          <ToastProvider>
            <Navbar />
            <div className="page-wrapper">
              {children}
            </div>
            <Footer />
          </ToastProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  );
}
