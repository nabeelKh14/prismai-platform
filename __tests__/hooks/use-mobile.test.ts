import { renderHook, act } from '@testing-library/react'
import { useIsMobile } from '@/hooks/use-mobile'

describe('useIsMobile', () => {
  beforeEach(() => {
    // Reset window dimensions before each test
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })
  })

  afterEach(() => {
    // Clean up any event listeners
    jest.clearAllMocks()
  })

  it('should return false for desktop screens', () => {
    // Mock desktop width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())

    // Should initially be undefined while determining screen size
    expect(result.current).toBe(false)
  })

  it('should return true for mobile screens', () => {
    // Mock mobile width
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    })

    const { result } = renderHook(() => useIsMobile())

    // Should return true for mobile screens
    expect(result.current).toBe(true)
  })

  it('should handle window resize events', () => {
    // Start with desktop size
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1024,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)

    // Simulate resize to mobile
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 600,
      })

      // Trigger the resize event
      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(true)

    // Simulate resize back to desktop
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })

      window.dispatchEvent(new Event('resize'))
    })

    expect(result.current).toBe(false)
  })

  it('should handle edge case at breakpoint boundary', () => {
    // Test exactly at the breakpoint (768px)
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 768,
    })

    const { result } = renderHook(() => useIsMobile())

    // Should be false at exactly 768px (mobile breakpoint is < 768)
    expect(result.current).toBe(false)
  })

  it('should handle very small screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 320,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(true)
  })

  it('should handle very large screens', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 1920,
    })

    const { result } = renderHook(() => useIsMobile())

    expect(result.current).toBe(false)
  })

  it('should clean up event listeners on unmount', () => {
    const addEventListenerSpy = jest.spyOn(window, 'addEventListener')
    const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener')

    const { unmount } = renderHook(() => useIsMobile())

    expect(addEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))

    unmount()

    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function))

    addEventListenerSpy.mockRestore()
    removeEventListenerSpy.mockRestore()
  })

  it('should handle multiple hook instances independently', () => {
    Object.defineProperty(window, 'innerWidth', {
      writable: true,
      configurable: true,
      value: 600,
    })

    const { result: result1 } = renderHook(() => useIsMobile())
    const { result: result2 } = renderHook(() => useIsMobile())

    expect(result1.current).toBe(true)
    expect(result2.current).toBe(true)

    // Change window size
    act(() => {
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 1024,
      })
      window.dispatchEvent(new Event('resize'))
    })

    expect(result1.current).toBe(false)
    expect(result2.current).toBe(false)
  })
})