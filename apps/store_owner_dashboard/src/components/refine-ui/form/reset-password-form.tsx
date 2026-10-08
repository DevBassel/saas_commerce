"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useNavigate, useSearchParams } from "react-router";
import { useNotification } from "@refinedev/core";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { InputPassword } from "@/components/refine-ui/form/input-password";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AuthShell } from "@/components/refine-ui/form/auth-shell";
import { OtpField } from "@/components/refine-ui/form/otp-field";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/components/refine-ui/form/auth-schema";
import { toApiError } from "@/api/client";
import { confirmPasswordReset } from "@/api/otp.api";

export const ResetPasswordForm = () => {
  const navigate = useNavigate();
  const { open } = useNotification();
  const [searchParams] = useSearchParams();
  const email = (searchParams.get("email") ?? "").trim();

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { code: "", password: "", confirm: "" },
  });

  const onSubmit = async (values: ResetPasswordFormValues) => {
    if (!email) {
      open?.({
        type: "error",
        message: "Missing email",
        description: "Request a new reset code to continue.",
      });
      return;
    }

    try {
      await confirmPasswordReset(email, values.code, values.password);
      open?.({
        type: "success",
        message: "Password changed",
        description: "Sign in with your new password.",
      });
      navigate("/login");
    } catch (error) {
      open?.({
        type: "error",
        message: "Could not reset password",
        description: toApiError(error).message,
      });
    }
  };

  if (!email) {
    return (
      <AuthShell>
        <Card className="sm:w-114">
          <CardHeader className="items-center gap-2 text-center">
            <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <ShieldCheck className="size-6" />
            </span>
            <CardTitle className="text-xl">Choose a new password</CardTitle>
            <CardDescription>
              We could not tell which account to reset.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button size="lg" onClick={() => navigate("/forgot-password")}>
              Request a reset code
            </Button>
          </CardFooter>
        </Card>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <Card className="sm:w-114">
        <CardHeader className="items-center gap-2 text-center">
          <span className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <ShieldCheck className="size-6" />
          </span>
          <CardTitle className="text-xl">Choose a new password</CardTitle>
          <CardDescription>
            Enter the code sent to {email} and pick a new password.
          </CardDescription>
        </CardHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
            <CardContent className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reset code</FormLabel>
                    <FormControl>
                      <OtpField
                        value={field.value}
                        onChange={field.onChange}
                        disabled={form.formState.isSubmitting}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <InputPassword
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>Must be 8-16 characters.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirm"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <InputPassword
                        autoComplete="new-password"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>

            <CardFooter className="flex-col gap-3 pt-4">
              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? "Saving..." : "Set new password"}
              </Button>
              <Button
                type="button"
                variant="link"
                onClick={() => navigate("/forgot-password")}
              >
                Request a new code
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </AuthShell>
  );
};

ResetPasswordForm.displayName = "ResetPasswordForm";
