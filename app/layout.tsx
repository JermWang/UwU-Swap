import "./globals.css";
import Link from "next/link";
import TokenContractBar from "./components/TokenContractBar";
import GlobalNavLinks from "./components/GlobalNavLinks";
import AsciiWaves from "./components/AsciiWaves";

export const metadata = {
  title: "Commit To Ship",
  description: "Custodial SOL escrow commitments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body data-skin="app">
        <AsciiWaves />
        <header className="globalNav">
          <div className="globalNavInner">
            <div className="globalNavLeft">
              <Link className="globalNavBrand" href="/">
                <img className="globalNavBrandMark" src="/branding/svg-logo.svg" alt="Commit To Ship" />
                <span className="globalNavBrandText">Commit To Ship</span>
              </Link>

              <TokenContractBar />
            </div>

            <GlobalNavLinks />
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}
