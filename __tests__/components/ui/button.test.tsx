import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Button, buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

describe('Button', () => {
  it('should render with default props', () => {
    render(<Button>Click me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center')
  })

  it('should render with custom className', () => {
    render(<Button className="custom-class">Click me</Button>)

    const button = screen.getByRole('button', { name: /click me/i })
    expect(button).toHaveClass('custom-class')
  })

  it('should render with different variants', () => {
    const { rerender } = render(<Button variant="default">Default</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-primary')

    rerender(<Button variant="destructive">Destructive</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-destructive')

    rerender(<Button variant="outline">Outline</Button>)
    expect(screen.getByRole('button')).toHaveClass('border', 'bg-background')

    rerender(<Button variant="secondary">Secondary</Button>)
    expect(screen.getByRole('button')).toHaveClass('bg-secondary')

    rerender(<Button variant="ghost">Ghost</Button>)
    expect(screen.getByRole('button')).toHaveClass('hover:bg-accent')

    rerender(<Button variant="link">Link</Button>)
    expect(screen.getByRole('button')).toHaveClass('text-primary', 'underline-offset-4')
  })

  it('should render with different sizes', () => {
    const { rerender } = render(<Button size="default">Default Size</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-9', 'px-4', 'py-2')

    rerender(<Button size="sm">Small</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-8', 'px-3')

    rerender(<Button size="lg">Large</Button>)
    expect(screen.getByRole('button')).toHaveClass('h-10', 'px-6')

    rerender(<Button size="icon">Icon</Button>)
    expect(screen.getByRole('button')).toHaveClass('size-9')
  })

  it('should handle disabled state', () => {
    render(<Button disabled>Disabled Button</Button>)

    const button = screen.getByRole('button', { name: /disabled button/i })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:pointer-events-none', 'disabled:opacity-50')
  })

  it('should handle onClick events', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick}>Clickable</Button>)

    const button = screen.getByRole('button', { name: /clickable/i })
    fireEvent.click(button)

    expect(handleClick).toHaveBeenCalledTimes(1)
  })

  it('should not trigger onClick when disabled', () => {
    const handleClick = jest.fn()
    render(<Button onClick={handleClick} disabled>Disabled Clickable</Button>)

    const button = screen.getByRole('button', { name: /disabled clickable/i })
    fireEvent.click(button)

    expect(handleClick).not.toHaveBeenCalled()
  })

  it('should render as child component when asChild is true', () => {
    render(
      <Button asChild>
        <a href="/test">Link Button</a>
      </Button>
    )

    const link = screen.getByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/test')
    expect(link).toHaveClass('inline-flex', 'items-center', 'justify-center')
  })

  it('should handle button type attribute', () => {
    render(<Button type="submit">Submit</Button>)

    const button = screen.getByRole('button', { name: /submit/i })
    expect(button).toHaveAttribute('type', 'submit')
  })

  it('should handle custom props', () => {
    render(
      <Button
        data-testid="custom-button"
        aria-label="Custom button"
        title="Button tooltip"
      >
        Custom
      </Button>
    )

    const button = screen.getByTestId('custom-button')
    expect(button).toHaveAttribute('aria-label', 'Custom button')
    expect(button).toHaveAttribute('title', 'Button tooltip')
  })

  it('should handle icon with text', () => {
    render(
      <Button>
        <span>Icon</span>
        Button Text
      </Button>
    )

    const button = screen.getByRole('button', { name: /button text/i })
    expect(button).toHaveTextContent('Icon')
    expect(button).toHaveTextContent('Button Text')
  })

  it('should handle loading state styling', () => {
    render(<Button disabled>Loading...</Button>)

    const button = screen.getByRole('button', { name: /loading/i })
    expect(button).toBeDisabled()
    expect(button).toHaveClass('disabled:opacity-50')
  })

  it('should handle focus styles', () => {
    render(<Button>Focus Test</Button>)

    const button = screen.getByRole('button', { name: /focus test/i })

    // Focus the button
    fireEvent.focus(button)

    expect(button).toHaveClass('focus-visible:border-ring', 'focus-visible:ring-ring/50')
  })

  it('should handle invalid state styling', () => {
    render(<Button aria-invalid="true">Invalid</Button>)

    const button = screen.getByRole('button', { name: /invalid/i })
    expect(button).toHaveClass('aria-invalid:ring-destructive/20', 'aria-invalid:border-destructive')
  })

  it('should handle dark mode classes', () => {
    render(<Button>Dark Mode</Button>)

    const button = screen.getByRole('button', { name: /dark mode/i })
    expect(button).toHaveClass('dark:aria-invalid:ring-destructive/40')
  })

  it('should handle SVG icon sizing', () => {
    render(
      <Button>
        <svg data-testid="icon" />
        With Icon
      </Button>
    )

    const button = screen.getByRole('button', { name: /with icon/i })
    const icon = screen.getByTestId('icon')

    expect(button).toHaveClass('[&_svg]:pointer-events-none', '[&_svg]:shrink-0')
    expect(icon).toHaveClass('size-4')
  })

  it('should handle custom SVG sizes', () => {
    render(
      <Button>
        <svg data-testid="custom-icon" className="size-6" />
        Custom Icon Size
      </Button>
    )

    const icon = screen.getByTestId('custom-icon')
    expect(icon).toHaveClass('size-6')
    expect(icon).not.toHaveClass('size-4') // Should not have default size
  })

  it('should handle button content changes', () => {
    const { rerender } = render(<Button>Initial</Button>)

    expect(screen.getByRole('button')).toHaveTextContent('Initial')

    rerender(<Button>Updated</Button>)

    expect(screen.getByRole('button')).toHaveTextContent('Updated')
  })

  it('should handle empty content', () => {
    render(<Button></Button>)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveClass('inline-flex', 'items-center', 'justify-center')
  })

  it('should handle whitespace-only content', () => {
    render(<Button>   </Button>)

    const button = screen.getByRole('button')
    expect(button).toBeInTheDocument()
  })

  it('should handle long text content', () => {
    const longText = 'This is a very long button text that should still be properly styled and displayed'
    render(<Button>{longText}</Button>)

    const button = screen.getByRole('button', { name: longText })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent(longText)
  })

  it('should handle special characters in content', () => {
    const specialText = 'Button with émojis 🎉 & special chars <>&"'
    render(<Button>{specialText}</Button>)

    const button = screen.getByRole('button', { name: specialText })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent(specialText)
  })

  it('should handle numeric content', () => {
    render(<Button>123</Button>)

    const button = screen.getByRole('button', { name: '123' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('123')
  })

  it('should handle zero content', () => {
    render(<Button>0</Button>)

    const button = screen.getByRole('button', { name: '0' })
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('0')
  })
})

describe('buttonVariants', () => {
  it('should generate correct className for default variant', () => {
    const className = buttonVariants()
    expect(className).toContain('inline-flex')
    expect(className).toContain('items-center')
    expect(className).toContain('justify-center')
    expect(className).toContain('bg-primary')
    expect(className).toContain('text-primary-foreground')
  })

  it('should generate correct className for destructive variant', () => {
    const className = buttonVariants({ variant: 'destructive' })
    expect(className).toContain('bg-destructive')
    expect(className).toContain('text-white')
  })

  it('should generate correct className for outline variant', () => {
    const className = buttonVariants({ variant: 'outline' })
    expect(className).toContain('border')
    expect(className).toContain('bg-background')
  })

  it('should generate correct className for secondary variant', () => {
    const className = buttonVariants({ variant: 'secondary' })
    expect(className).toContain('bg-secondary')
    expect(className).toContain('text-secondary-foreground')
  })

  it('should generate correct className for ghost variant', () => {
    const className = buttonVariants({ variant: 'ghost' })
    expect(className).toContain('hover:bg-accent')
    expect(className).toContain('hover:text-accent-foreground')
  })

  it('should generate correct className for link variant', () => {
    const className = buttonVariants({ variant: 'link' })
    expect(className).toContain('text-primary')
    expect(className).toContain('underline-offset-4')
    expect(className).toContain('hover:underline')
  })

  it('should generate correct className for different sizes', () => {
    expect(buttonVariants({ size: 'sm' })).toContain('h-8')
    expect(buttonVariants({ size: 'lg' })).toContain('h-10')
    expect(buttonVariants({ size: 'icon' })).toContain('size-9')
  })

  it('should handle custom className with variants', () => {
    const className = buttonVariants({ variant: 'outline', className: 'custom-class' })
    expect(className).toContain('custom-class')
    expect(className).toContain('border')
    expect(className).toContain('bg-background')
  })

  it('should handle conflicting Tailwind classes', () => {
    const className = buttonVariants({ variant: 'outline', className: 'px-2 px-4' })
    expect(className).toContain('px-4') // Last one should win
    expect(className).not.toContain('px-2')
  })
})