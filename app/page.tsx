"use client";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Discord, GitHub, Twitter, YouTube } from "@/components/icons/icons";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/home/navbar";
import { Input } from "@/components/ui/input";
import Hero from "@/components/home/hero";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { z } from "zod";

const betaSignupSchema = z.object({
  email: z.string().email().min(9),
});

export default function BetaSignup() {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<z.infer<typeof betaSignupSchema>>({
    resolver: zodResolver(betaSignupSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof betaSignupSchema>) => {
    setIsSubmitting(true);
    try {
      console.log("Starting form submission with email:", values.email);

      const response = await fetch("/api/auth/early-access", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email: values.email }),
      });

      // Log the raw response text first
      const rawText = await response.text();
      console.log("Raw response:", rawText);

      // Try to parse as JSON
      let data;
      try {
        data = JSON.parse(rawText);
        console.log("Parsed response data:", data);
      } catch (parseError) {
        console.error("Failed to parse response as JSON:", parseError);
        throw new Error("Invalid server response");
      }

      if (!response.ok) {
        throw new Error(data.error || "Failed to sign up");
      }

      form.reset();
      console.log("Form submission successful");
      toast.success("Thanks for signing up for early access!");
    } catch (error) {
      console.error("Form submission error:", {
        error,
        message: error instanceof Error ? error.message : "Unknown error",
      });
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
      console.log("Form submission completed");
    }
  };

  return (
    <div className="relative min-h-screen w-full bg-grid-small-black/[0.12] dark:bg-grid-small-white/[0.025]">
      {/* Radial gradient for the container to give a faded look */}
      {/* <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[300px] w-[300px] bg-gradient-to-r from-pink-300/5 via-yellow-300/5 to-green-300/5 blur-[200px] rounded-full" />
      </div> */}
      <div className="relative mx-auto flex max-w-7xl flex-col">
        <Navbar />
        <Hero />
      </div>
    </div>
  );
}
