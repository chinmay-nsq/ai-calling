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
  payload: any;
}

export const scheduleRetry = async ({
  roomName,
  retryAttempt,
  payload,
}: ScheduleRetryParams) => {
  // Retry after 5 mins
  const retryDate = new Date(Date.now() + 5 * 60 * 1000);

  // Scheduler requires this format:
  // at(2026-05-18T12:30:00)
  const formattedDate = retryDate.toISOString().split(".")[0];

  // Unique schedule name
  const scheduleName = `retry-${roomName}-${retryAttempt}-${Date.now()}`;

  // Fake API Gateway event
  const lambdaPayload = {
    rawPath: "/make-call",
    body: JSON.stringify(payload),
  };

  const command = new CreateScheduleCommand({
    Name: scheduleName,

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
