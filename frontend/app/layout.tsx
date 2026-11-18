import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CRMProvider } from "@/lib/crm-context";
import { QueryProvider } from "@/components/providers/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/components/auth/auth-provider";

const plusJakartaSans = localFont({
  src: "./fonts/PlusJakartaSans-variable.ttf",
  variable: "--font-plus-jakarta-sans",
  weight: "200 800",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hexavara CRM",
  description: "Customer Relationship Management System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={plusJakartaSans.variable}>
      <body className="antialiased">
        <QueryProvider>
          <AuthProvider>
            <TooltipProvider>
              <CRMProvider>{children}</CRMProvider>
            </TooltipProvider>
            <Toaster position="top-right" richColors />
          </AuthProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
