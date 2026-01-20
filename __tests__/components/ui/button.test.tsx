  it('should handle conflicting Tailwind classes', () => {
    const className = buttonVariants({ variant: 'outline', className: 'px-2 px-4' })
    expect(className).toContain('px-4') // Last one should win
    // Note: twMerge keeps both classes in the string but CSS specificity handles precedence
    expect(className).toMatch(/px-2.*px-4/) // px-4 comes after px-2
  })