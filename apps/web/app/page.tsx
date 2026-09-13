"use client";

import { useState } from "react";

export default function Home() {
  const [meetingCode, setMeetingCode] = useState("");

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (meetingCode.trim()) {
      // Future tickets (T-25) will handle room navigation & validation
      console.log("Join meeting:", meetingCode);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#202124] text-[#e8eaed]">
      {/* Navigation Bar */}
      <header className="flex h-16 items-center justify-between px-6 border-b border-[#3c4043]/50">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#8ab4f8]/15 text-[#8ab4f8]">
            <svg
              className="h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
          </div>
          <span className="text-xl font-medium tracking-tight text-[#e8eaed]">
            Google Meet
          </span>
        </div>

        <div className="flex items-center gap-4 text-sm text-[#9aa0a6]">
          <span>Fastify + WebRTC Mesh</span>
        </div>
      </header>

      {/* Main Hero Content */}
      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="grid w-full max-w-6xl grid-cols-1 items-center gap-12 lg:grid-cols-2">
          {/* Left Column: Actions */}
          <div className="flex flex-col gap-6">
            <h1 className="text-4xl font-normal leading-tight tracking-tight text-[#e8eaed] sm:text-5xl">
              Video calls and meetings for everyone
            </h1>
            <p className="text-lg text-[#9aa0a6] max-w-lg">
              Connect, collaborate, and celebrate from anywhere with Google Meet
              clone.
            </p>

            {/* Action Bar: New Meeting & Join by Code */}
            <div className="flex flex-wrap items-center gap-4 pt-4">
              <button
                type="button"
                className="flex h-12 items-center gap-2 rounded-md bg-[#8ab4f8] px-6 font-medium text-[#202124] transition-colors hover:bg-[#aecbfa] focus:outline-none focus:ring-2 focus:ring-[#8ab4f8] focus:ring-offset-2 focus:ring-offset-[#202124]"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                </svg>
                New meeting
              </button>

              <form onSubmit={handleJoin} className="flex items-center gap-3">
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-[#9aa0a6]">
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={meetingCode}
                    onChange={(e) => setMeetingCode(e.target.value)}
                    placeholder="Enter a code"
                    className="h-12 w-48 sm:w-60 rounded-md border border-[#5f6368] bg-transparent pl-10 pr-4 text-sm text-[#e8eaed] placeholder-[#9aa0a6] focus:border-[#8ab4f8] focus:outline-none focus:ring-1 focus:ring-[#8ab4f8]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!meetingCode.trim()}
                  className="h-12 px-4 text-sm font-medium text-[#8ab4f8] transition-colors hover:text-[#aecbfa] disabled:cursor-not-allowed disabled:text-[#5f6368]"
                >
                  Join
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Visual Preview Card */}
          <div className="flex justify-center">
            <div className="relative flex flex-col items-center justify-center rounded-2xl border border-[#3c4043] bg-[#2d2e30]/50 p-12 text-center shadow-xl backdrop-blur-sm max-w-md w-full">
              <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-[#3c4043] text-[#8ab4f8]">
                <svg
                  className="h-12 w-12"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                  />
                </svg>
              </div>
              <h2 className="text-xl font-medium text-[#e8eaed]">
                Get a link you can share
              </h2>
              <p className="mt-2 text-sm text-[#9aa0a6]">
                Click <strong>New meeting</strong> to get a link you can send to
                people you want to meet with.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
