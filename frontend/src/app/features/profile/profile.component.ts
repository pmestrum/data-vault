import { Component } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../core/auth/auth.service';

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

  form = this.fb.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required],
    },
    { validators: this.matchPasswords },
  );

  constructor(private fb: FormBuilder, private auth: AuthService) {}

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
}

