import z from "zod";

export const makeCallRequestSchema = z.object({
  candidateId: z.string(),
  candidateName: z.string(),
  candidatePhone: z.string(),
  jobRole: z.string(),
  jobDescription: z.string(),
  companyName: z.string(),
  aboutCompany: z.string().optional(),
  scheduledTime: z.string().datetime().optional(), // ISO string, optional
});

export const getCallDetailsRequestSchema = z.object({
  roomName: z.string({ error: "Room name is required" }),
});

export type MakeCallRequest = z.infer<typeof makeCallRequestSchema>;
