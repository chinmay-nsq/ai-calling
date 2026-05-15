// models/CallModel.ts
import mongoose, { Schema, Document } from "mongoose";

const callOutcomeSchema = new Schema(
  {
    asked_call_back: { type: Boolean, default: false },
    call_back_time: { type: Date, default: null },
    asked_interview_rescheduling: { type: Boolean, default: false },
    new_interview_time: { type: Date, default: null },
  },
  { _id: false },
);

const transcriptMessageSchema = new Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    text: { type: String, required: true },
    timestamp: { type: Number, required: true },
  },
  { _id: false },
);

const callSchema = new Schema(
  {
    // Candidate info
    candidateId: { type: String, required: true },
    candidateName: { type: String, required: true },
    candidatePhone: { type: String, required: true },
    jobRole: { type: String, required: true },
    jobDescription: { type: String, required: true },
    companyName: { type: String, required: true },
    aboutCompany: { type: String, default: "" },

    // Room info
    room_name: { type: String, default: "" },

    // Call control
    status: {
      type: String,
      enum: [
        "scheduled",
        "in_progress",
        "completed",
        "failed",
        "retrying",
        "exhausted",
      ],
      default: "scheduled",
    },
    scheduledTime: { type: Date, required: true },
    maxRetryCount: { type: Number, default: 3 },
    currentTry: { type: Number, default: 1 },

    // Post-call
    call_outcome: { type: callOutcomeSchema, default: null },
    transcript: { type: [transcriptMessageSchema], default: [] },
  },
  { timestamps: true },
);

export const CallModel = mongoose.model("ai_call_collection", callSchema);
