import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';
import { CurlSettingsService } from '../../core/records/curl-settings.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
})
export class ProfileComponent {
  loading = false;
  error = '';
  success = '';
  curlSettingsSuccess = '';
  curlSettingsError = '';

  form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: this.matchPasswords },
  );

  curlForm = this.fb.group({
    publicUrl: ['', Validators.required],
    absoluteApiPath: ['/api', Validators.required],
  });

  constructor(
    private fb: FormBuilder,
    private auth: AuthService,
    private curlSettings: CurlSettingsService,
  ) {
    const settings = this.curlSettings.getSettings();
    this.curlForm.patchValue(settings);
  }

  matchPasswords(group: any) {
    const np = group.get('newPassword')?.value;
    const cp = group.get('confirmPassword')?.value;
    return np === cp ? null : { mismatch: true };
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.error = '';
    this.success = '';
    const { currentPassword, newPassword } = this.form.getRawValue();
    this.auth.changePassword(currentPassword!, newPassword!).subscribe({
      next: () => {
        this.success = 'Password changed successfully.';
        this.form.reset();
        this.loading = false;
      },
      error: (err) => {
        this.error = err?.error?.message ?? 'Failed to change password';
        this.loading = false;
      },
    });
  }

  saveCurlSettings(): void {
    if (this.curlForm.invalid) {
      this.curlSettingsError = 'Both URL fields are required.';
      this.curlSettingsSuccess = '';
      return;
    }

    const { publicUrl, absoluteApiPath } = this.curlForm.getRawValue();
    const saved = this.curlSettings.saveSettings({
      publicUrl: publicUrl ?? '',
      absoluteApiPath: absoluteApiPath ?? '',
    });

    this.curlForm.patchValue(saved);
    this.curlSettingsError = '';
    this.curlSettingsSuccess = 'cURL URL settings saved.';
  }
}

