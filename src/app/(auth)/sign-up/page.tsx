import type { Metadata } from "next";
import { redirect } from "next/navigation";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAuthContext } from "@/lib/auth/guards";
import { SignUpForm } from "@/features/authentication/components/sign-up-form";

export const metadata: Metadata = { title: "Create account — Curbfare" };

export default async function SignUpPage() {
  const ctx = await getAuthContext();
  if (ctx) {
    redirect("/onboarding");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create your account</CardTitle>
        <CardDescription>
          Find the best street food near you, or bring more customers to your
          cart.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUpForm />
      </CardContent>
    </Card>
  );
}
