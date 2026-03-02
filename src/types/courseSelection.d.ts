export interface CourseReview {
  course_name: string;
  course_teacher: string;
  course_id: number;
  rating: number;
  comments: string[];
  comment_sum: number;
}

export interface CourseReviewsData {
  courses: CourseReview[];
  lastUpdate?: number;
  totalCount?: number;
}

export interface GroupAnalysis {
  groupName: string;
  groupType: string;
  requiredCredits: number;
  completedCredits: number;
  requiredCourses: number;
  completedCourses: number;
  isCompleted: boolean;
  remainingCredits: number;
  remainingCourses: number;
  incompleteCourseList: Array<{ courseId: string; courseName: string; credits: number; grade?: string; gpa?: number }>;
  completedCourseList?: Array<{ courseId: string; courseName: string; credits: number; grade?: string; gpa?: number }>;
  enrolledCourseList?: Array<{ courseId: string; courseName: string; credits: number; grade?: string; gpa?: number }>;
}

export interface TrainingPlanReport {
  studentInfo: { studentId: string; name: string; totalCredits: number; completedCredits: number };
  summary: { totalRequired: number; totalCompleted: number; totalRemaining: number; completionRate: string };
  byType: {
    required: { groups: GroupAnalysis[]; totalRequired: number; totalCompleted: number };
    elective: { groups: GroupAnalysis[]; totalRequired: number; totalCompleted: number };
    optional: { groups: GroupAnalysis[]; totalRequired: number; totalCompleted: number };
  };
  incompleteGroups: GroupAnalysis[];
  timestamp?: string;
}

export interface CourseSelectionData {
  trainingPlan?: { report: TrainingPlanReport; recommendations: unknown[]; parsedData: unknown };
  reviews?: CourseReviewsData;
  lastUpdate?: number;
}
