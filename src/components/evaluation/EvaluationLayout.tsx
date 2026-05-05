// src/components/evaluation/EvaluationLayout.tsx
"use client";

import { useState } from "react";
import { useRecorder } from "../hooks/useRecorder";
import RecordControl from "./RecordControl";
import EvaluationStatus from "./EvaluationStatus";
import ResultPanel from "./ResultPanel";
import NextActionBar from "./NextActionBar";

type EvaluationState = "ready" | "recording" | "analyzing" | "done";

type Props = {
    mode?: "practice" | "quick-check" | "level-test";
};

export default function EvaluationLayout({ mode = "practice" }: Props) {
    const [state, setState] = useState<EvaluationState>("ready");
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);

    const { start, stop } = useRecorder();
    const evaluate = async (audio: Blob) => {
        const formData = new FormData();
        formData.append("audio", audio);
        formData.append(
            "text",
            "This is a sample sentence for pronunciation assessment."
        );

        const res = await fetch("/api/evaluate", {
            method: "POST",
            body: formData,
        });

        const data = await res.json();
        console.log("Evaluation result:", data);

        // ⚠️ 지금은 결과를 state에 안 넣고, 연결만 확인
    };

    // 🔁 녹음 시작
    const handleStart = async () => {
        setState("recording");
        await start();
    };

    // ⏹ 녹음 종료
    const handleStop = async () => {
        setState("analyzing");
        const blob = await stop();
        setAudioBlob(blob);

        await evaluate(blob);
        setState("done");
    };


    // 🔄 다시 시작
    const handleReset = () => {
        setAudioBlob(null);
        setState("ready");
    };

    return (
        <section className="max-w-xl mx-auto mt-10 p-6 border rounded-2xl">
            {/* 상태: ready / recording */}
            {(state === "ready" || state === "recording") && (
                <RecordControl
                    isRecording={state === "recording"}
                    onStart={handleStart}
                    onStop={handleStop}
                />

            )}

            {/* 상태: analyzing */}
            {state === "analyzing" && <EvaluationStatus />}

            {/* 상태: done */}
            {state === "done" && (
                <>
                    <ResultPanel audio={audioBlob} mode={mode} />
                    <NextActionBar onRetry={handleReset} />
                </>
            )}
        </section>
    );
}
