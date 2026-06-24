import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/context/ThemeContext";
import { SidebarProvider } from "@/components/context/SidebarContext";
import { AuthProvider } from "@/components/dashboard/AuthProvider";

export const metadata: Metadata = {
  title: "DurianPro — Smart Agriculture",
  description: "AI-powered durian ripeness detection and quality inspection dashboard",
  icons: {
    icon: "/logo-square.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&family=Sora:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ThemeProvider>
          <SidebarProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
