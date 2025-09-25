import { describe, it, expect } from '@jest/globals'
import { cn } from '@/lib/utils'

describe('Utils', () => {
  describe('cn function', () => {
    it('should combine class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2')
    })

    it('should handle conditional classes', () => {
      expect(cn('class1', true && 'class2', false && 'class3')).toBe('class1 class2')
    })

    it('should handle undefined and null values', () => {
      expect(cn('class1', undefined, null, 'class2')).toBe('class1 class2')
    })

    it('should handle empty strings', () => {
      expect(cn('class1', '', 'class2')).toBe('class1 class2')
    })

    it('should merge conflicting Tailwind classes', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4')
    })

    it('should handle array inputs', () => {
      expect(cn(['class1', 'class2'])).toBe('class1 class2')
    })

    it('should handle complex combinations', () => {
      expect(cn(
        'base-class',
        true && 'conditional-class',
        false && 'false-class',
        'another-class'
      )).toBe('base-class conditional-class another-class')
    })

    it('should handle object syntax', () => {
      expect(cn({
        'class1': true,
        'class2': false,
        'class3': true
      })).toBe('class1 class3')
    })

    it('should handle mixed inputs', () => {
      expect(cn(
        'base',
        { 'conditional1': true, 'conditional2': false },
        ['array1', 'array2']
      )).toBe('base conditional1 array1 array2')
    })
  })
})