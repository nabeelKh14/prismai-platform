  it('should handle send message error', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ messages: [] }),
    } as Response)

    const errorMessage = 'Failed to send message'
    mockFetch.mockRejectedValueOnce(new Error(errorMessage))

    const { result } = renderHook(() => useConversation(mockConversationId))

    await expect(result.current.sendMessage('Test message')).rejects.toThrow(errorMessage)

    // Wait for error state to be updated
    await waitFor(() => {
      expect(result.current.error).toBe(errorMessage)
    })
  })