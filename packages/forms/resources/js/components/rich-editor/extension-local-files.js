import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'

const defaultAllowedMimeTypes = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const defaultMaxFileSize = 10 * 1024 * 1024 // 10MB in bytes
const defaultFileSizeExceededMessage = 'File size exceeds maximum allowed'
const defaultInvalidMimeTypeMessage = 'File type is not allowed'

const dispatchFormEvent = (editorView, name, detail = {}) => {
    editorView.dom.closest('form')?.dispatchEvent(
        new CustomEvent(name, {
            composed: true,
            cancelable: true,
            detail,
        }),
    )
}

const validateFile = (file, allowedMimeTypes, maxFileSize, invalidMimeTypeMessage, fileSizeExceededMessage) => {
    const errors = []
    
    if (!allowedMimeTypes.includes(file.type)) {
        errors.push(invalidMimeTypeMessage || defaultInvalidMimeTypeMessage)
    }
    
    if (file.size > +maxFileSize * 1024) {
        errors.push(fileSizeExceededMessage || defaultFileSizeExceededMessage)
    }
    
    return {
        isValid: errors.length === 0,
        errors
    }
}

const LocalFilesPlugin = ({
    editor,
    get$WireUsing,
    key,
    statePath,
    uploadingMessage,
    allowedMimeTypes,
    maxFileSize,
    fileSizeExceededMessage,
    invalidMimeTypeMessage,
}) => {
    // Use defaults if not provided from PHP
    const effectiveAllowedMimeTypes = allowedMimeTypes || defaultAllowedMimeTypes
    const effectiveMaxFileSize = maxFileSize || defaultMaxFileSize
    
    const getFileAttachmentUrl = (fileKey) =>
        get$WireUsing().callSchemaComponentMethod(
            key,
            'getUploadedFileAttachmentTemporaryUrl',
            {
                attachment: fileKey,
            },
        )

    return new Plugin({
        key: new PluginKey('localFiles'),
        props: {
            handleDrop(editorView, event) {
                if (!event.dataTransfer?.files.length) {
                    return false
                }

                const allFiles = Array.from(event.dataTransfer.files)
                const validFiles = []
                const rejectedFiles = []

                allFiles.forEach(file => {
                    const validation = validateFile(file, effectiveAllowedMimeTypes, effectiveMaxFileSize, invalidMimeTypeMessage, fileSizeExceededMessage)
                    if (validation.isValid) {
                        validFiles.push(file)
                    } else {
                        rejectedFiles.push({ file, errors: validation.errors })
                    }
                })

                if (rejectedFiles.length > 0) {
                    const errorMessages = rejectedFiles.map(({ file, errors }) => 
                        `<p>${file.name}: ${errors.join(', ')}</p>`
                    ).join('')

                    new FilamentNotification()
                        .body(errorMessages)
                        .danger()
                        .send()
                }

                if (!validFiles.length) {
                    return false
                }

                const files = validFiles

                dispatchFormEvent(editorView, 'form-processing-started', {
                    message: uploadingMessage,
                })

                event.preventDefault()
                event.stopPropagation()

                const position = editorView.posAtCoords({
                    left: event.clientX,
                    top: event.clientY,
                })

                files.forEach((file, fileIndex) => {
                    editor.setEditable(false)
                    editorView.dom.dispatchEvent(
                        new CustomEvent('rich-editor-uploading-file', {
                            bubbles: true,
                            detail: {
                                key,
                                livewireId: get$WireUsing().id,
                            },
                        }),
                    )

                    const fileReader = new FileReader()

                    fileReader.readAsDataURL(file)
                    fileReader.onload = () => {
                        editor
                            .chain()
                            .insertContentAt(position?.pos ?? 0, {
                                type: 'image',
                                attrs: {
                                    class: 'fi-loading',
                                    src: fileReader.result,
                                },
                            })
                            .run()
                    }

                    let fileKey = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(
                        /[018]/g,
                        (c) =>
                            (
                                c ^
                                (crypto.getRandomValues(new Uint8Array(1))[0] &
                                    (15 >> (c / 4)))
                            ).toString(16),
                    )

                    get$WireUsing().upload(
                        `componentFileAttachments.${statePath}.${fileKey}`,
                        file,
                        () => {
                            getFileAttachmentUrl(fileKey).then((url) => {
                                if (!url) {
                                    return
                                }

                                editor
                                    .chain()
                                    .updateAttributes('image', {
                                        class: null,
                                        id: fileKey,
                                        src: url,
                                    })
                                    .run()

                                editor.setEditable(true)
                                editorView.dom.dispatchEvent(
                                    new CustomEvent(
                                        'rich-editor-uploaded-file',
                                        {
                                            bubbles: true,
                                            detail: {
                                                key,
                                                livewireId: get$WireUsing().id,
                                            },
                                        },
                                    ),
                                )

                                if (fileIndex === files.length - 1) {
                                    dispatchFormEvent(
                                        editorView,
                                        'form-processing-finished',
                                    )
                                }
                            })
                        },
                    )
                })

                return true
            },
            handlePaste(editorView, event) {
                if (!event.clipboardData?.files.length) {
                    return false
                }

                const allFiles = Array.from(event.clipboardData.files)
                const validFiles = []
                const rejectedFiles = []

                allFiles.forEach(file => {
                    const validation = validateFile(file, effectiveAllowedMimeTypes, effectiveMaxFileSize, invalidMimeTypeMessage, fileSizeExceededMessage)
                    if (validation.isValid) {
                        validFiles.push(file)
                    } else {
                        rejectedFiles.push({ file, errors: validation.errors })
                    }
                })

                if (rejectedFiles.length > 0) {
                    const errorMessages = rejectedFiles.map(({ file, errors }) => 
                        `<p>${file.name}: ${errors.join(', ')}</p>`
                    ).join('')

                    new FilamentNotification()
                        .body(errorMessages)
                        .danger()
                        .send()
                }

                if (!validFiles.length) {
                    return false
                }

                const files = validFiles

                event.preventDefault()
                event.stopPropagation()

                dispatchFormEvent(editorView, 'form-processing-started', {
                    message: uploadingMessage,
                })

                files.forEach((file, fileIndex) => {
                    editor.setEditable(false)
                    editorView.dom.dispatchEvent(
                        new CustomEvent('rich-editor-uploading-file', {
                            bubbles: true,
                            detail: {
                                key,
                                livewireId: get$WireUsing().id,
                            },
                        }),
                    )

                    const fileReader = new FileReader()

                    fileReader.readAsDataURL(file)
                    fileReader.onload = () => {
                        editor
                            .chain()
                            .insertContentAt(editor.state.selection.anchor, {
                                type: 'image',
                                attrs: {
                                    class: 'fi-loading',
                                    src: fileReader.result,
                                },
                            })
                            .run()
                    }

                    let fileKey = ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(
                        /[018]/g,
                        (c) =>
                            (
                                c ^
                                (crypto.getRandomValues(new Uint8Array(1))[0] &
                                    (15 >> (c / 4)))
                            ).toString(16),
                    )

                    get$WireUsing().upload(
                        `componentFileAttachments.${statePath}.${fileKey}`,
                        file,
                        () => {
                            getFileAttachmentUrl(fileKey).then((url) => {
                                if (!url) {
                                    return
                                }

                                editor
                                    .chain()
                                    .updateAttributes('image', {
                                        class: null,
                                        id: fileKey,
                                        src: url,
                                    })
                                    .run()

                                editor.setEditable(true)
                                editorView.dom.dispatchEvent(
                                    new CustomEvent(
                                        'rich-editor-uploaded-file',
                                        {
                                            bubbles: true,
                                            detail: {
                                                key,
                                                livewireId: get$WireUsing().id,
                                            },
                                        },
                                    ),
                                )

                                if (fileIndex === files.length - 1) {
                                    dispatchFormEvent(
                                        editorView,
                                        'form-processing-finished',
                                    )
                                }
                            })
                        },
                    )
                })

                return true
            },
        },
    })
}

export default Extension.create({
    name: 'localFiles',

    addOptions() {
        return {
            key: null,
            statePath: null,
            uploadingMessage: null,
            get$WireUsing: null,
            allowedMimeTypes: defaultAllowedMimeTypes,
            maxFileSize: defaultMaxFileSize,
            fileSizeExceededMessage: defaultFileSizeExceededMessage,
            invalidMimeTypeMessage: defaultInvalidMimeTypeMessage,
        }
    },

    addProseMirrorPlugins() {
        return [
            LocalFilesPlugin({
                editor: this.editor,
                ...this.options,
            }),
        ]
    },
})
