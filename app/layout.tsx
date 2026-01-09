import "./globals.css";
import "@solana/wallet-adapter-react-ui/styles.css";
import SolanaWalletProvider from "./components/SolanaWalletProvider";
import { ToastProvider } from "./components/ToastProvider";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import AsciiShaderBackground from "./components/AsciiShaderBackground";

export const metadata = {
  title: "Uwu Swap",
  description: "Untraceable transfers powered by zero-knowledge routing",
  icons: {
    icon: [{ url: "/branding/AI_assistant_avatar.png", type: "image/png" }],
  },
  openGraph: {
    title: "Uwu Swap",
    description: "Untraceable transfers powered by zero-knowledge routing",
    type: "website",
    images: [
      {
        url: "/branding/uwu-swap-banner.png",
        width: 1200,
        height: 630,
        alt: "Uwu Swap - Untraceable transfers powered by zero-knowledge routing",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Uwu Swap",
    description: "Untraceable transfers powered by zero-knowledge routing",
    images: ["/branding/uwu-swap-banner.png"],
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
