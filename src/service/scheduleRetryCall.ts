import {
  SchedulerClient,
  CreateScheduleCommand,
} from "@aws-sdk/client-scheduler";

const scheduler = new SchedulerClient({
  region: process.env.AWS_REGION,
});

interface ScheduleRetryParams {
  roomName: string;
  retryAttempt: number;
  delayMs: number;
  payload: any;
}

export const scheduleRetry = async ({
  roomName,
  retryAttempt,
  delayMs,
  payload,
}: ScheduleRetryParams) => {
  // Retry after the specified delay
  const retryDate = new Date(Date.now() + delayMs);

  // Scheduler requires this format:
  // at(2026-05-18T12:30:00)
  const formattedDate = retryDate.toISOString().split(".")[0];

  // Unique schedule name
  const scheduleName = `retry-${roomName}-${retryAttempt}-${Date.now()}`;

  // Fake API Gateway event
  const lambdaPayload = {
    rawPath: "/prod/make-call",
    body: JSON.stringify(payload),
  };

  const command = new CreateScheduleCommand({
    Name: scheduleName,
    GroupName: "default",
    ScheduleExpression: `at(${formattedDate})`,

    FlexibleTimeWindow: {
      Mode: "OFF",
    },

    Target: {
      Arn: process.env.LAMBDA_ARN!,
      RoleArn: process.env.SCHEDULER_ROLE_ARN!,
      Input: JSON.stringify(lambdaPayload),
    },

    ActionAfterCompletion: "DELETE",
  });

  await scheduler.send(command);

  console.log(
    `Retry scheduled for ${roomName} at ${formattedDate} [attempt ${retryAttempt}]`,
  );
};

type RetryMode = "testing" | "production";

export const getRetryDelayMs = (
  retryAttempt: number,
  mode: RetryMode = "production",
) => {
  if (mode === "testing") {
    return 5 * 60 * 1000;
  }

  switch (retryAttempt) {
    case 1:
      return 1 * 60 * 60 * 1000;

    case 2:
      return 2 * 60 * 60 * 1000;

    case 3:
      return 4 * 60 * 60 * 1000;

    default:
      return 24 * 60 * 60 * 1000;
  }
};

export const isWithinCallingHours = (date: Date, timezone: string): boolean => {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    }).format(date),
    10,
  );
  return hour >= 10 && hour < 20; // 10 AM to 8 PM
};
