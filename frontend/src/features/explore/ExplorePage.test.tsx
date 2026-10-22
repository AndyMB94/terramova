import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ExplorePage } from "./ExplorePage";

describe("ExplorePage", () => {
  it("muestra el nombre y el estado de construcción", () => {
    render(<ExplorePage />);

    expect(screen.getByRole("heading", { level: 1, name: "TerraMova" })).toBeInTheDocument();
    expect(screen.getByText(/en construcción/i)).toBeInTheDocument();
  });
});
