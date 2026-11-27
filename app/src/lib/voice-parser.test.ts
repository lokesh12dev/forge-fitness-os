import { describe, expect, it } from "vitest";
import { normalizeNumberWords, parseWorkoutVoiceCommand } from "./voice-parser";

describe("Voice and Natural Language Workout Parser (C1)", () => {
  describe("normalizeNumberWords", () => {
    it("converts single number words to digits", () => {
      expect(normalizeNumberWords("one two three")).toBe("1 2 3");
      expect(normalizeNumberWords("eight reps")).toBe("8 reps");
      expect(normalizeNumberWords("ten")).toBe("10");
    });

    it("converts compound number words to digits", () => {
      expect(normalizeNumberWords("eighty five")).toBe("85");
      expect(normalizeNumberWords("twenty two")).toBe("22");
      expect(normalizeNumberWords("forty five kilos")).toBe("45 kilos");
    });

    it("converts decimal words like point five", () => {
      expect(normalizeNumberWords("seven point five")).toBe("7.5");
      expect(normalizeNumberWords("eight and a half")).toBe("8.5");
    });
  });

  describe("parseWorkoutVoiceCommand - Shorthand Notation", () => {
    it("parses 100x8@8", () => {
      const res = parseWorkoutVoiceCommand("100x8@8");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(100);
      expect(res.reps).toBe(8);
      expect(res.rpe).toBe(8);
    });

    it("parses 140 x 5 @ 8.5 with spaces", () => {
      const res = parseWorkoutVoiceCommand("140 x 5 @ 8.5");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(140);
      expect(res.reps).toBe(5);
      expect(res.rpe).toBe(8.5);
    });

    it("parses 82.5x10@9", () => {
      const res = parseWorkoutVoiceCommand("82.5x10@9");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(82.5);
      expect(res.reps).toBe(10);
      expect(res.rpe).toBe(9);
    });

    it("parses 60*12 with default RPE", () => {
      const res = parseWorkoutVoiceCommand("60*12", { currentRpe: 7.5 });
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(60);
      expect(res.reps).toBe(12);
      expect(res.rpe).toBe(7.5);
    });

    it("parses 225x5@rpe9", () => {
      const res = parseWorkoutVoiceCommand("225x5@rpe9");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(225);
      expect(res.reps).toBe(5);
      expect(res.rpe).toBe(9);
    });
  });

  describe("parseWorkoutVoiceCommand - Spoken Gym Phrases", () => {
    it("parses 'bench 100 kilos for 8 reps at rpe 8'", () => {
      const res = parseWorkoutVoiceCommand("bench 100 kilos for 8 reps at rpe 8");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(100);
      expect(res.reps).toBe(8);
      expect(res.rpe).toBe(8);
      expect(res.exerciseName?.toLowerCase()).toContain("bench");
    });

    it("parses 'squat 140 for 5'", () => {
      const res = parseWorkoutVoiceCommand("squat 140 for 5");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(140);
      expect(res.reps).toBe(5);
      expect(res.exerciseName?.toLowerCase()).toContain("squat");
    });

    it("parses 'deadlift 180 kg for 3 reps at rpe 9'", () => {
      const res = parseWorkoutVoiceCommand("deadlift 180 kg for 3 reps at rpe 9");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(180);
      expect(res.reps).toBe(3);
      expect(res.rpe).toBe(9);
    });

    it("parses 'overhead press 60 kilos for 6'", () => {
      const res = parseWorkoutVoiceCommand("overhead press 60 kilos for 6");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(60);
      expect(res.reps).toBe(6);
      expect(res.exerciseName?.toLowerCase()).toContain("overhead press");
    });

    it("parses 'incline dumbbell press 34 for 10'", () => {
      const res = parseWorkoutVoiceCommand("incline dumbbell press 34 for 10");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(34);
      expect(res.reps).toBe(10);
    });

    it("parses 'barbell row 80 for 8 reps with 2 rir'", () => {
      const res = parseWorkoutVoiceCommand("barbell row 80 for 8 reps with 2 rir");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(80);
      expect(res.reps).toBe(8);
      expect(res.rpe).toBe(8); // 10 - 2 RIR = RPE 8
    });

    it("parses 'lateral raise 14 kilos for 15 reps'", () => {
      const res = parseWorkoutVoiceCommand("lateral raise 14 kilos for 15 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(14);
      expect(res.reps).toBe(15);
    });

    it("parses 'front squat 100 kg for 6 reps'", () => {
      const res = parseWorkoutVoiceCommand("front squat 100 kg for 6 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(100);
      expect(res.reps).toBe(6);
      expect(res.exerciseName?.toLowerCase()).toContain("front squat");
    });

    it("parses 'romanian deadlift 120 for 8 reps'", () => {
      const res = parseWorkoutVoiceCommand("romanian deadlift 120 for 8 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(120);
      expect(res.reps).toBe(8);
      expect(res.exerciseName?.toLowerCase()).toContain("romanian deadlift");
    });

    it("parses 'rdl 110 for 10 reps'", () => {
      const res = parseWorkoutVoiceCommand("rdl 110 for 10 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(110);
      expect(res.reps).toBe(10);
    });

    it("parses 'lat pulldown 70 kilos for 12 reps'", () => {
      const res = parseWorkoutVoiceCommand("lat pulldown 70 kilos for 12 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(70);
      expect(res.reps).toBe(12);
    });

    it("parses 'bicep curl 18 for 12'", () => {
      const res = parseWorkoutVoiceCommand("bicep curl 18 for 12");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(18);
      expect(res.reps).toBe(12);
    });

    it("parses 'tricep pushdown 35 kg for 15 reps'", () => {
      const res = parseWorkoutVoiceCommand("tricep pushdown 35 kg for 15 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(35);
      expect(res.reps).toBe(15);
    });

    it("parses 'pullups bodyweight for 10 reps'", () => {
      const res = parseWorkoutVoiceCommand("pullups bodyweight for 10 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(0);
      expect(res.reps).toBe(10);
      expect(res.exerciseName?.toLowerCase()).toContain("pullup");
    });
  });

  describe("parseWorkoutVoiceCommand - Plate Slang", () => {
    it("parses 'one plate for 5' -> 60kg", () => {
      const res = parseWorkoutVoiceCommand("bench one plate for 5");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(60);
      expect(res.reps).toBe(5);
    });

    it("parses 'two plates for 8' -> 100kg", () => {
      const res = parseWorkoutVoiceCommand("squat two plates for 8");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(100);
      expect(res.reps).toBe(8);
    });

    it("parses 'three plates for 3' -> 140kg", () => {
      const res = parseWorkoutVoiceCommand("deadlift three plates for 3");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(140);
      expect(res.reps).toBe(3);
    });

    it("parses 'four plates for 1' -> 180kg", () => {
      const res = parseWorkoutVoiceCommand("deadlift four plates for 1");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(180);
      expect(res.reps).toBe(1);
    });

    it("parses 'plate and a quarter for 10' -> 70kg", () => {
      const res = parseWorkoutVoiceCommand("bench plate and a quarter for 10");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(70);
      expect(res.reps).toBe(10);
    });

    it("parses 'plate and a quarter for 8 at rpe 8.5'", () => {
      const res = parseWorkoutVoiceCommand("bench plate and a quarter for 8 at rpe 8.5");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(70);
      expect(res.reps).toBe(8);
      expect(res.rpe).toBe(8.5);
    });

    it("parses 'three plates for 5 reps'", () => {
      const res = parseWorkoutVoiceCommand("squat three plates for 5 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(140);
      expect(res.reps).toBe(5);
    });

    it("parses '2 plates for 10'", () => {
      const res = parseWorkoutVoiceCommand("2 plates for 10");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(100);
      expect(res.reps).toBe(10);
    });

    it("parses 'half plate for 15' -> 40kg", () => {
      const res = parseWorkoutVoiceCommand("bench half plate for 15");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(40);
      expect(res.reps).toBe(15);
    });

    it("parses 'two and a half plates for 5' -> 120kg", () => {
      const res = parseWorkoutVoiceCommand("squat two and a half plates for 5");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(120);
      expect(res.reps).toBe(5);
    });

    it("parses 'five plates for 1' -> 220kg", () => {
      const res = parseWorkoutVoiceCommand("deadlift five plates for 1");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(220);
      expect(res.reps).toBe(1);
    });

    it("parses 'plate and a dime for 8' -> 80kg", () => {
      const res = parseWorkoutVoiceCommand("bench plate and a dime for 8");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(80);
      expect(res.reps).toBe(8);
    });
  });

  describe("parseWorkoutVoiceCommand - Imperial and Fractional Weights", () => {
    it("parses 'bench 225 lbs for 5 reps'", () => {
      const res = parseWorkoutVoiceCommand("bench 225 lbs for 5 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(225);
      expect(res.reps).toBe(5);
    });

    it("parses '135 pounds for 10'", () => {
      const res = parseWorkoutVoiceCommand("135 pounds for 10");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(135);
      expect(res.reps).toBe(10);
    });

    it("parses '77.5 for 8 reps at rpe 8'", () => {
      const res = parseWorkoutVoiceCommand("77.5 for 8 reps at rpe 8");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(77.5);
      expect(res.reps).toBe(8);
      expect(res.rpe).toBe(8);
    });

    it("parses '102.5 kilos for 4 reps'", () => {
      const res = parseWorkoutVoiceCommand("102.5 kilos for 4 reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(102.5);
      expect(res.reps).toBe(4);
    });

    it("parses '42.5 for 12'", () => {
      const res = parseWorkoutVoiceCommand("42.5 for 12");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(42.5);
      expect(res.reps).toBe(12);
    });
  });

  describe("parseWorkoutVoiceCommand - RIR and Edge RPE", () => {
    it("parses '100 for 8 with 1 rir' -> RPE 9", () => {
      const res = parseWorkoutVoiceCommand("100 for 8 with 1 rir");
      expect(res.matched).toBe(true);
      expect(res.rpe).toBe(9);
    });

    it("parses '100 for 8 with 3 reps in reserve' -> RPE 7", () => {
      const res = parseWorkoutVoiceCommand("100 for 8 with 3 reps in reserve");
      expect(res.matched).toBe(true);
      expect(res.rpe).toBe(7);
    });

    it("parses '100 for 8 with 0 rir' -> RPE 10", () => {
      const res = parseWorkoutVoiceCommand("100 for 8 with 0 rir");
      expect(res.matched).toBe(true);
      expect(res.rpe).toBe(10);
    });

    it("clamps RPE above 10 to 10", () => {
      const res = parseWorkoutVoiceCommand("100 for 8 at rpe 11");
      expect(res.matched).toBe(true);
      expect(res.rpe).toBe(10);
    });

    it("clamps RPE below 1 to 1", () => {
      const res = parseWorkoutVoiceCommand("100 for 8 at rpe 0.5");
      expect(res.matched).toBe(true);
      expect(res.rpe).toBe(1);
    });
  });

  describe("parseWorkoutVoiceCommand - More Spoken Word Combinations", () => {
    it("parses 'thirty two kilos for twelve reps'", () => {
      const res = parseWorkoutVoiceCommand("thirty two kilos for twelve reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(32);
      expect(res.reps).toBe(12);
    });

    it("parses 'fifty kilos for ten reps'", () => {
      const res = parseWorkoutVoiceCommand("fifty kilos for ten reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(50);
      expect(res.reps).toBe(10);
    });

    it("parses 'sixteen kilos for fifteen reps'", () => {
      const res = parseWorkoutVoiceCommand("sixteen kilos for fifteen reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(16);
      expect(res.reps).toBe(15);
    });

    it("parses 'ninety kilos for five reps'", () => {
      const res = parseWorkoutVoiceCommand("ninety kilos for five reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(90);
      expect(res.reps).toBe(5);
    });

    it("parses 'one hundred twenty for three'", () => {
      const res = parseWorkoutVoiceCommand("one hundred twenty for three");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(120);
      expect(res.reps).toBe(3);
    });

    it("parses 'eighty kilos for eight'", () => {
      const res = parseWorkoutVoiceCommand("eighty kilos for eight");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(80);
      expect(res.reps).toBe(8);
    });
  });

  describe("parseWorkoutVoiceCommand - Spoken Number Words", () => {
    it("parses 'eighty five kilos for eight reps at rpe seven point five'", () => {
      const res = parseWorkoutVoiceCommand("eighty five kilos for eight reps at rpe seven point five");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(85);
      expect(res.reps).toBe(8);
      expect(res.rpe).toBe(7.5);
    });

    it("parses 'one hundred for ten reps'", () => {
      const res = parseWorkoutVoiceCommand("one hundred for ten reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(100);
      expect(res.reps).toBe(10);
    });

    it("parses 'seventy two point five for six reps'", () => {
      const res = parseWorkoutVoiceCommand("seventy two point five for six reps");
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(72.5);
      expect(res.reps).toBe(6);
    });
  });

  describe("parseWorkoutVoiceCommand - Set Qualifiers", () => {
    it("detects warmup sets", () => {
      const res = parseWorkoutVoiceCommand("warmup 60 kilos for 10 reps");
      expect(res.matched).toBe(true);
      expect(res.isWarmup).toBe(true);
      expect(res.weightKg).toBe(60);
      expect(res.reps).toBe(10);
    });

    it("detects failure sets", () => {
      const res = parseWorkoutVoiceCommand("failure 90 for 12 reps");
      expect(res.matched).toBe(true);
      expect(res.isFailure).toBe(true);
      expect(res.weightKg).toBe(90);
      expect(res.reps).toBe(12);
    });
  });

  describe("parseWorkoutVoiceCommand - Timer & Navigation Commands", () => {
    it("handles 'skip rest'", () => {
      const res = parseWorkoutVoiceCommand("skip rest");
      expect(res.matched).toBe(true);
      expect(res.action).toBe("skip_rest");
    });

    it("handles 'add 30 seconds'", () => {
      const res = parseWorkoutVoiceCommand("add 30 seconds");
      expect(res.matched).toBe(true);
      expect(res.action).toBe("adjust_rest");
      expect(res.restAdjustmentSec).toBe(30);
    });

    it("handles 'next exercise'", () => {
      const res = parseWorkoutVoiceCommand("next exercise");
      expect(res.matched).toBe(true);
      expect(res.action).toBe("next_exercise");
    });
  });

  describe("parseWorkoutVoiceCommand - Context Fallback & Error Handling", () => {
    it("infers current weight when only reps are spoken", () => {
      const res = parseWorkoutVoiceCommand("for 12 reps", { currentWeight: 75, currentRpe: 8 });
      expect(res.matched).toBe(true);
      expect(res.weightKg).toBe(75);
      expect(res.reps).toBe(12);
    });

    it("rejects non-workout gibberish safely", () => {
      const res = parseWorkoutVoiceCommand("what is the weather today in Delhi");
      expect(res.matched).toBe(false);
      expect(res.action).toBe("unknown");
    });

    it("rejects empty string safely", () => {
      const res = parseWorkoutVoiceCommand("   ");
      expect(res.matched).toBe(false);
    });
  });
});
